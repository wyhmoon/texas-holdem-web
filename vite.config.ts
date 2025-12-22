import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'os'

// 获取本机IP地址
function getLocalIP() {
  const interfaces = networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      // 跳过回环地址和IPv6
      if (!iface.internal || iface.family !== 'IPv4') {
        continue
      }
      // 通常以192.168, 10.0, 172.16-31开头的是局域网IP
      if (
        iface.address.startsWith('192.168') ||
        iface.address.startsWith('10.') ||
        (iface.address.startsWith('172.') && 
          parseInt(iface.address.split('.')[1]) >= 16 && 
          parseInt(iface.address.split('.')[1]) <= 31)
      ) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

// 自定义插件用于输出访问地址
const networkAddressPlugin: Plugin = {
  name: 'network-address',
  configureServer(server) {
    server.httpServer?.once('listening', () => {
      const addr = server.httpServer?.address()
      if (addr && typeof addr === 'object' && addr.port) {
        const localIP = getLocalIP()
        console.log(`\n局域网其他玩家可通过以下地址访问游戏:`)
        console.log(`  http://${localIP}:${addr.port}`)
        console.log(`\n本机访问地址:`)
        console.log(`  http://localhost:${addr.port}`)
        console.log(`  http://${localIP}:${addr.port}`)
      }
    })
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), networkAddressPlugin],
  server: {
    host: true, // 监听所有网络接口
    port: 5173,
    strictPort: false,
    hmr: {
      clientPort: 5173
    },
    open: false // 不自动打开浏览器
  }
})
