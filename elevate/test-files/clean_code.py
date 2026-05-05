from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Student:
    name: str
    grades: List[float]

    def average(self) -> float:
        if not self.grades:
            return 0.0
        return sum(self.grades) / len(self.grades)

    def letter_grade(self) -> str:
        avg = self.average()
        if avg >= 90:
            return "A"
        elif avg >= 80:
            return "B"
        elif avg >= 70:
            return "C"
        elif avg >= 60:
            return "D"
        return "F"


def top_students(students: List[Student], n: int = 3) -> List[Student]:
    return sorted(students, key=lambda s: s.average(), reverse=True)[:n]


def class_average(students: List[Student]) -> Optional[float]:
    if not students:
        return None
    return sum(s.average() for s in students) / len(students)


students = [
    Student("Alice", [92, 88, 95]),
    Student("Bob", [74, 81, 69]),
    Student("Carol", [55, 60, 58]),
    Student("Dave", [98, 97, 100]),
]

for s in students:
    print(f"{s.name}: {s.average():.1f} ({s.letter_grade()})")

print(f"\nClass average: {class_average(students):.1f}")
print(f"Top students: {[s.name for s in top_students(students)]}")
