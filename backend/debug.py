import urllib.request
import re

endpoints = [
    'http://127.0.0.1:8000/api/clubs/1/',
    'http://127.0.0.1:8000/api/clubs/1/members/',
    'http://127.0.0.1:8000/api/clubs/1/posts/',
    'http://127.0.0.1:8000/api/clubs/1/club_events/',
    'http://127.0.0.1:8000/api/clubs/1/wall/'
]

for url in endpoints:
    try:
        req = urllib.request.Request(url)
        res = urllib.request.urlopen(req)
        print(url, '-->', res.getcode())
    except urllib.error.HTTPError as e:
        print(url, '-->', e.code)
        if e.code == 500:
            html = e.read().decode('utf-8')
            exc = re.search(r'Exception Value:.*?<pre>(.*?)</pre>', html, re.DOTALL)
            if exc:
                print('   EXCEPTION:', exc.group(1).strip())
            else:
                print('   Could not parse exception from 500 HTML')
