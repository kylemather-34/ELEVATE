def countdown(n):
    print(n)
    countdown(n - 1)

def factorial(n):
    return n * factorial(n - 1)

def is_even(n):
    if n == 0:
        return True
    return is_odd(n - 1)

def is_odd(n):
    if n == 0:
        return False
    return is_even(n - 1)

countdown(5)
print(factorial(10))
print(is_even(4))
