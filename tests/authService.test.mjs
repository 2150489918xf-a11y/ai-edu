import assert from 'node:assert/strict';

import {
  createAuthService,
  hashPassword,
  verifyPassword
} from '../server/services/authService.js';

function createPrismaMock() {
  const users = [
    {
      id: 'user-admin-office',
      username: 'admin-office',
      passwordHash: hashPassword('admin123', 'salt-admin'),
      role: 'admin',
      status: 'active',
      teacher: null,
      student: null
    },
    {
      id: 'user-teacher-wang',
      username: 'teacher-wang',
      passwordHash: hashPassword('teacher123', 'salt-teacher'),
      role: 'teacher',
      status: 'active',
      teacher: {
        id: 'teacher-wang',
        name: '王老师',
        email: 'wang@example.com',
        phone: '13800000000'
      },
      student: null
    },
    {
      id: 'user-stu-chenyu',
      username: 'stu-chenyu',
      passwordHash: hashPassword('student123', 'salt-student'),
      role: 'student',
      status: 'active',
      teacher: null,
      student: {
        id: 'stu-chenyu',
        name: '陈雨',
        studentNo: 'S20260103',
        class: {
          id: 'class-1',
          name: '高一 3 班',
          grade: '高一',
          subject: '物理',
          teacher: { id: 'teacher-wang', name: '王老师' }
        }
      }
    }
  ];

  return {
    user: {
      async findUnique({ where }) {
        return users.find((user) => user.username === where.username || user.id === where.id) || null;
      }
    }
  };
}

const service = createAuthService(createPrismaMock(), {
  jwtSecret: 'test-secret',
  now: () => 1_000_000
});

assert.equal(verifyPassword('teacher123', hashPassword('teacher123', 'salt-teacher')), true);
assert.equal(verifyPassword('wrong', hashPassword('teacher123', 'salt-teacher')), false);

const teacherLogin = await service.login({ username: 'teacher-wang', password: 'teacher123' });
assert.equal(teacherLogin.user.role, 'teacher');
assert.equal(teacherLogin.profile.name, '王老师');
assert.ok(teacherLogin.token.length > 20);

const teacherMe = await service.getCurrentUser(teacherLogin.token);
assert.equal(teacherMe.user.username, 'teacher-wang');
assert.equal(teacherMe.profile.id, 'teacher-wang');

const studentLogin = await service.login({ username: 'stu-chenyu', password: 'student123' });
assert.equal(studentLogin.user.role, 'student');
assert.equal(studentLogin.profile.className, '高一 3 班');
assert.equal(studentLogin.profile.teacher, '王老师');

const adminLogin = await service.login({ username: 'admin-office', password: 'admin123' });
assert.equal(adminLogin.user.role, 'admin');
assert.equal(adminLogin.profile.role, 'admin');

await assert.rejects(
  () => service.login({ username: 'teacher-wang', password: 'bad-password' }),
  /账号或密码错误/
);
await assert.rejects(
  () => service.getCurrentUser(`${teacherLogin.token}x`),
  /登录已失效/
);

console.log('auth service contracts passed');
