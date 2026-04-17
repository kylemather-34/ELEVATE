def add(a, b):
    return a + b

def get_length(obj):
    return obj.length

def process(data):
    for item in data:
        print(item.upper())

def square_all(nums):
    return [n ** 2 for n in nums]

result1 = add("5", 10)
result2 = add([1, 2], "three")

name = "Alice"
length = get_length(name)
print(length)

process("hello")
process(12345)

nums = [1, 2, "three", 4]
print(square_all(nums))

d = {"key": "value"}
print(d["missing_key"])

x = None
print(x.strip())
