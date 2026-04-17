def append_item(item, lst=[]):
    lst.append(item)
    return lst

def add_tag(tag, tags={}):
    tags[tag] = True
    return tags

def build_queue(task, queue=[]):
    queue.append(task)
    return queue

class Pipeline:
    def __init__(self, steps=[]):
        self.steps = steps

    def add_step(self, step):
        self.steps.append(step)

    def run(self):
        for step in self.steps:
            print(f"Running: {step}")

print(append_item("a"))
print(append_item("b"))
print(append_item("c"))

p1 = Pipeline()
p2 = Pipeline()
p1.add_step("parse")
p2.add_step("render")
p1.run()
p2.run()
