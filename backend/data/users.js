import bcrypt from 'bcryptjs';

const users = [
  {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: bcrypt.hashSync('123', 10),
    isAdmin: true,
  },
  {
    name: 'John Doe',
    email: 'ram@gmail.com',
    password: bcrypt.hashSync('123', 10),
  },
  {
    name: 'Jane Doe',
    email: 'niraj@gmail.com',
    password: bcrypt.hashSync('123', 10),
  },
];

export default users;
