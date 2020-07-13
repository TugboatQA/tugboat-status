const http_server = require('http');
const http_proxy = require('http-proxy');
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
        feed_url: 'https://status.tugboat.qa/rss',
        site_url: 'https://www.tugboat.qa',
        image_url: 'https://tugboat.qa/images/logo/logo_horizontal_light.svg',
        docs: 'https://docs.tugboat.qa',
        copyright: 'Tugboat',
        language: 'en',
        pubDate: new Date(),
    });

    outages.outage_list.forEach((outage) => {
        feed.item({
            title: `Incident at ${new Date(outage.start_time)}`,
            description: outage.description,
            url: 'https://status.tugboat.qa',
            guid: outage.hash,
            date: new Date(outage.start_time),
        });
    });

    return feed.xml({ indent: true });
}

async function http(req, res) {
    if (req.url === '/rss') {
        const body = await rss();

        res.setHeader('Cache-Control', 'max-age=0, private, must-revalidate');
        res.setHeader('Content-Type', 'application/rss+xml');

        return res.end(body);
    }

    const target = 'https://status.panopta.com';

    if (req.url === '/') {
        return proxy.web(req, res, { target: `${target}/tugboat`, changeOrigin: true, ignorePath: true });
    }

    return proxy.web(req, res, { target, changeOrigin: true });
}

server.listen(3000, (err) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Service listening on port 3000');
    }
});
