import { io } from 'socket.io-client';

const options = {
  // reconnectionDelay: 1000,
};

// 初始化实例
const socket = io('//localhost:4567', options);

// 只要连接上了服务端，就会执行下面的代码. 这是主动连接
socket.on('connect', async () => {
  console.log('成功？', socket.id);
  socket.emit('message', '222222');
  socket.emit('joinRoom', 'aaa');
});

socket.on('message', (message) => {
  console.log('客户端', message);
});

socket.on('disconnect', () => {
  console.log('断开连接');
});

export default socket;
