const fs = require('fs');
const http_server = require('http');
const http_proxy = require('http-proxy');
const path = require('path');
const request = require('request-promise-native');

const RSS = require('rss');

const server = http_server.createServer(http);
const proxy = http_proxy.createServer({ xfwd: true });

async function rss() {
    const apikey = process.env.APIKEY;

    const outages = await request('https://api2.panopta.com/v2/outage', {
        headers: { authorization: `ApiKey ${apikey}` },
        json: true,
    });

    const feed = new RSS({
        title: 'Tugboat Status - Incident History',
        feed_url: 'https://www.tugboatqa-status.com/rss',
        site_url: 'https://www.tugboatqa.com',
        image_url: 'https://tugboatqa.github.io/assets.tugboat.qa/images/logo/logo_horizontal_light.svg',
        docs: 'https://docs.tugboatqa.com',
        copyright: 'Tugboat',
        language: 'en',
        pubDate: new Date(),
    });

    outages.outage_list.forEach((outage) => {
        if (!outage.exclude_from_availability) {
            feed.item({
                title: `Incident at ${new Date(outage.start_time)}`,
                description: outage.description,
                url: 'https://www.tugboatqa-status.com',
                guid: outage.hash,
                date: new Date(outage.start_time),
            });
        }
    });

    return feed.xml({ indent: true });
}

async function svg(req, res) {
    const file = path.join(__dirname, req.url);
    const stream = fs.createReadStream(file);

    stream.on('open', () => {
        res.setHeader('Content-Type', 'image/svg+xml');
        stream.pipe(res);
    });

    stream.on('error', () => {
        res.setHeader('Content-Type', 'text/plain');
        res.statusCode = 404;
        res.end('Not Found');
    });
}

async function http(req, res) {
    if (req.url === '/_status') {
        return res.end('Status OK');
    }

    if (req.url === '/rss') {
        const body = await rss();

        res.setHeader('Cache-Control', 'max-age=0, private, must-revalidate');
        res.setHeader('Content-Type', 'application/rss+xml');

        return res.end(body);
    }

    if (req.url.match(/^\/svg\/.*/)) {
        return svg(req, res);
    }

    const target = 'https://status.panopta.com';

    if (req.url === '/') {
        return proxy.web(req, res, { target: `${target}/tugboat`, changeOrigin: true, ignorePath: true });
    }

    return proxy.web(req, res, { target, changeOrigin: true });
}

const port = process.env.PORT || 3000;
server.listen(port, (err) => {
    if (err) {
        console.error(err);
    } else {
        console.log(`Service listening on port ${port}`);
    }
});
