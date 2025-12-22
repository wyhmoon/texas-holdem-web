import WebSocket from 'ws';

// 创建一个WebSocket客户端连接到服务器
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', function open() {
  console.log('已连接到服务器');
  
  // 发送创建房间的消息
  const createRoomMessage = {
    type: 'create-room',
    playerName: '测试玩家'
  };
  
  console.log('发送创建房间消息:', createRoomMessage);
  ws.send(JSON.stringify(createRoomMessage));
});

ws.on('message', function message(data) {
  const message = JSON.parse(data.toString());
  console.log('收到服务器消息:', message);
  
  // 如果收到房间创建成功的消息，就断开连接
  if (message.type === 'room-created') {
    console.log(`房间创建成功！房间号: ${message.roomId}`);
    setTimeout(() => {
      ws.close();
    }, 1000);
  }
});

ws.on('close', function close() {
  console.log('连接已关闭');
});

ws.on('error', function error(err) {
  console.error('WebSocket错误:', err);
});