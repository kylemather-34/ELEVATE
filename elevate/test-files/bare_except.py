import os

def read_config(path):
    try:
        with open(path, "r") as f:
            return f.read()
    except:
        return None

def divide(a, b):
    try:
        return a / b
    except:
        print("error")
        return 0

def load_user(user_id):
    try:
        data = read_config(f"/etc/app/users/{user_id}.cfg")
        if data is None:
            raise ValueError("missing config")
        return data.strip()
    except:
        pass

result = divide(10, 0)
print(result)
cfg = load_user(42)
print(cfg)
