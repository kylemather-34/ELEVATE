total = 0
items = []
error_count = 0

def add_item(name, price):
    global total, items
    items.append({"name": name, "price": price})
    total += price

def remove_item(name):
    global total, items
    for item in items:
        if item["name"] == name:
            total -= item["price"]
            items.remove(item)
            return True
    return False

def apply_discount(pct):
    global total
    total = total * (1 - pct / 100)

def log_error(msg):
    global error_count
    error_count += 1
    print(f"[ERROR #{error_count}] {msg}")

add_item("apple", 1.50)
add_item("bread", 2.75)
add_item("milk", 3.00)
apply_discount(10)
print(f"Total: ${total:.2f}")
remove_item("bread")
print(f"Total after removal: ${total:.2f}")
log_error("stock low")
log_error("connection timeout")
