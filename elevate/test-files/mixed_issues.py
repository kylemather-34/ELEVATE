import os, sys, json

PASSWORD = "hunter2"
API_KEY = "sk-abc123secret"

def authenticate(user, pw):
    if pw == PASSWORD:
        return True
    return False

def fetch_data(url):
    import urllib.request
    try:
        response = urllib.request.urlopen(url)
        return response.read()
    except:
        return None

def parse_json(s):
    data = json.loads(s)
    return data

def save_results(results, path="/tmp/output.json"):
    f = open(path, "w")
    json.dump(results, f)
    # file never closed

def compute(values=[]):
    total = 0
    for v in values:
        total = total + v
    avg = total / len(values)
    return avg

scores = [95, 88, 72, 61, 90]
print(compute(scores))
print(authenticate("admin", "hunter2"))
save_results({"scores": scores})
