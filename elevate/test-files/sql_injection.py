import sqlite3

conn = sqlite3.connect("users.db")
cursor = conn.cursor()

def get_user(username):
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()

def delete_user(user_id):
    cursor.execute("DELETE FROM users WHERE id = " + str(user_id))
    conn.commit()

def search_products(keyword):
    sql = f"SELECT * FROM products WHERE name LIKE '%{keyword}%'"
    cursor.execute(sql)
    return cursor.fetchall()

def login(username, password):
    query = "SELECT id FROM users WHERE username='" + username + "' AND password='" + password + "'"
    cursor.execute(query)
    row = cursor.fetchone()
    return row is not None

print(get_user("admin"))
print(login("admin", "password123"))
