# 100-line Python script
import random
import math

class Particle:
    def __init__(self, x, y, vx, vy):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy

    def move(self):
        self.x += self.vx
        self.y += self.vy

    def distance_from_origin(self):
        return math.sqrt(self.x**2 + self.y**2)

particles = []
for _ in range(20):
    particles.append(
        Particle(
            random.uniform(-10, 10),
            random.uniform(-10, 10),
            random.uniform(-1, 1),
            random.uniform(-1, 1),
        )
    )

for step in range(10):
    print(f"Step {step + 1}")
    for i, particle in enumerate(particles):
        particle.move()
        print(
            f"Particle {i}: "
            f"pos=({particle.x:.2f}, {particle.y:.2f}) "
            f"dist={particle.distance_from_origin():.2f}"
        )
    avg_distance = sum(
        p.distance_from_origin() for p in particles
    ) / len(particles)
    print(f"Average distance: {avg_distance:.2f}")
    print("-" * 40)

    summary = {
    "max_distance": max(p.distance_from_origin() for p in particles),
    "min_distance": min(p.distance_from_origin() for p in particles),
    "avg_distance": sum(p.distance_from_origin() for p in particles) / len(particles),
}

print("Simulation complete")
for key, value in summary.items():
    print(f"{key}: {value:.2f}")
