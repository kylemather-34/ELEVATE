import time

# O(n^2) duplicate check instead of using a set
def has_duplicates(lst):
    for i in range(len(lst)):
        for j in range(len(lst)):
            if i != j and lst[i] == lst[j]:
                return True
    return False

# String concatenation in a loop
def build_report(rows):
    result = ""
    for row in rows:
        result += row + "\n"
    return result

# Repeated list search instead of dict lookup
def find_score(name, records):
    for record in records:
        if record[0] == name:
            return record[1]
    return None

# Recomputing len on every iteration
def process_items(items):
    i = 0
    while i < len(items):
        print(items[i])
        i += 1

data = list(range(1000))
start = time.time()
print(has_duplicates(data))
print(f"has_duplicates: {time.time() - start:.4f}s")

rows = [f"row_{i}" for i in range(500)]
start = time.time()
report = build_report(rows)
print(f"build_report: {time.time() - start:.4f}s")
