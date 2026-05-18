const http = require('http')
const fs = require('fs')
const path = require('path')

const root = __dirname
const port = parseInt(process.env.FRONTEND_PORT || process.env.PORT || '8081', 10)
const host = process.env.FRONTEND_HOST || '127.0.0.1'

const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
}

function send(res, status, body, type) {
    res.writeHead(status, { 'Content-Type': type || 'text/plain' })
    res.end(body)
}

http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0])
    const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '')
    const filePath = path.join(root, safePath === '/' ? '/pages/index.ejs' : safePath)

    if (!filePath.startsWith(root)) return send(res, 403, 'Forbidden')

    fs.readFile(filePath, (err, data) => {
        if (err) return send(res, 404, 'Not found')
        send(res, 200, data, contentTypes[path.extname(filePath)] || 'application/octet-stream')
    })
}).listen(port, host, () => {
    console.log(`Xenocipher frontend static preview running at http://${host}:${port}`)
})
