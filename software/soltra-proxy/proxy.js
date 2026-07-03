const http = require('http');
const httpProxy = require('http-proxy');

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({});

// Target servers
const TARGETS = {
    CV: 'http://127.0.0.1:5000',
    TTS: 'http://127.0.0.1:8099',
    OLLAMA: 'http://127.0.0.1:11434'
};

const server = http.createServer((req, res) => {
    // 1. Route for TTS
    if (req.url.startsWith('/tts')) {
        // We strip the /tts prefix so the TTS server gets exactly what it expects
        req.url = req.url.replace('/tts', '');
        if (req.url === '') req.url = '/';
        
        proxy.web(req, res, { target: TARGETS.TTS }, (e) => {
            console.error('TTS Proxy error:', e);
            res.writeHead(502);
            res.end('TTS Server is down or unreachable.');
        });
    } 
    // 2. Route for Ollama
    else if (req.url.startsWith('/ollama')) {
        req.url = req.url.replace('/ollama', '');
        if (req.url === '') req.url = '/';
        
        proxy.web(req, res, { target: TARGETS.OLLAMA }, (e) => {
            console.error('Ollama Proxy error:', e);
            res.writeHead(502);
            res.end('Ollama Server is down or unreachable.');
        });
    }
    // 3. Route for everything else (CV Stream, /capture, /stream, etc)
    else {
        proxy.web(req, res, { target: TARGETS.CV }, (e) => {
            console.error('CV Proxy error:', e);
            res.writeHead(502);
            res.end('CV Server is down or unreachable.');
        });
    }
});

// Handle proxying websockets properly if needed
server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/tts')) {
        req.url = req.url.replace('/tts', '');
        if (req.url === '') req.url = '/';
        proxy.ws(req, socket, head, { target: TARGETS.TTS });
    } else if (req.url.startsWith('/ollama')) {
        req.url = req.url.replace('/ollama', '');
        if (req.url === '') req.url = '/';
        proxy.ws(req, socket, head, { target: TARGETS.OLLAMA });
    } else {
        proxy.ws(req, socket, head, { target: TARGETS.CV });
    }
});

console.log('Soltra Proxy is listening on port 8080...');
console.log(`- Routing /tts/* -> ${TARGETS.TTS}`);
console.log(`- Routing /ollama/* -> ${TARGETS.OLLAMA}`);
console.log(`- Routing /* -> ${TARGETS.CV}`);

server.listen(8080);
