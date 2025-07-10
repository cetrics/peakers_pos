from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('test/index.html')

@app.route('/sw.js')
def sw():
    response = app.make_response("""
        const CACHE_NAME = 'offline-cache-v1';
        const urlsToCache = [
            '/',
        ];

        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then(cache => cache.addAll(urlsToCache))
            );
        });

        self.addEventListener('fetch', event => {
            event.respondWith(
                caches.match(event.request)
                    .then(response => response || fetch(event.request))
            );
        });
    """)
    response.headers['Content-Type'] = 'application/javascript'
    return response

if __name__ == '__main__':
    app.run(debug=True)
