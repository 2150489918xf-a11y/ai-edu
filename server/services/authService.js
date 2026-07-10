import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return buffer.toString('base64url');
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function parseBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw createHttpError(401, 'UNAUTHORIZED', '登录已失效');
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw createHttpError(401, 'UNAUTHORIZED', '登录已失效');
  }
  return parseBase64UrlJson(payload);
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [algorithm, iterations, salt, expectedHash] = String(passwordHash || '').split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterations || !salt || !expectedHash) return false;
  const actualHash = pbkdf2Sync(String(password), salt, Number(iterations), 32, 'sha256').toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(actualHash, 'hex');
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function normalizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status
  };
}

function normalizeProfile(user) {
  if (user.role === 'admin') {
    return {
      id: user.id,
      name: '教务管理员',
      role: 'admin'
    };
  }

  if (user.role === 'teacher' && user.teacher) {
    return {
      id: user.teacher.id,
      name: user.teacher.name,
      phone: user.teacher.phone || '',
      email: user.teacher.email || '',
      avatarUrl: user.teacher.avatarUrl || '',
      role: 'teacher'
    };
  }

  if (user.role === 'student' && user.student) {
    return {
      id: user.student.id,
      name: user.student.name,
      studentNo: user.student.studentNo || '',
      classId: user.student.class?.id || user.student.classId || '',
      className: user.student.class?.name || '',
      grade: user.student.class?.grade || '',
      subject: user.student.class?.subject || '',
      teacher: user.student.class?.teacher?.name || '任课老师',
      role: 'student'
    };
  }

  return null;
}

function getJwtSecret(options = {}) {
  return options.jwtSecret || process.env.JWT_SECRET || process.env.AUTH_SECRET || 'eduai-local-dev-secret';
}

function getNowSeconds(options = {}) {
  return Math.floor((options.now ? options.now() : Date.now()) / 1000);
}

function getUserInclude() {
  return {
    teacher: true,
    student: {
      include: {
        class: {
          include: { teacher: true }
        }
      }
    }
  };
}

export function createAuthService(prisma, options = {}) {
  const jwtSecret = getJwtSecret(options);
  const tokenTtlSeconds = Number(options.tokenTtlSeconds || DEFAULT_TOKEN_TTL_SECONDS);

  async function findUserById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: getUserInclude()
    });
  }

  return {
    async login(payload = {}) {
      const username = String(payload.username || '').trim();
      const password = String(payload.password || '');
      if (!username || !password) throw createHttpError(400, 'BAD_REQUEST', '请输入账号和密码');

      const user = await prisma.user.findUnique({
        where: { username },
        include: getUserInclude()
      });
      if (!user || user.status !== 'active' || !verifyPassword(password, user.passwordHash)) {
        throw createHttpError(401, 'UNAUTHORIZED', '账号或密码错误');
      }

      const now = getNowSeconds(options);
      const token = signJwt({
        sub: user.id,
        username: user.username,
        role: user.role,
        iat: now,
        exp: now + tokenTtlSeconds
      }, jwtSecret);

      return {
        token,
        user: normalizeUser(user),
        profile: normalizeProfile(user)
      };
    },

    async getCurrentUser(token) {
      const payload = verifyJwt(token, jwtSecret);
      const now = getNowSeconds(options);
      if (!payload.sub || !payload.exp || payload.exp < now) {
        throw createHttpError(401, 'UNAUTHORIZED', '登录已失效');
      }
      const user = await findUserById(payload.sub);
      if (!user || user.status !== 'active') throw createHttpError(401, 'UNAUTHORIZED', '登录已失效');
      return {
        user: normalizeUser(user),
        profile: normalizeProfile(user)
      };
    }
  };
}
