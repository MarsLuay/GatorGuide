from django.db import models

#Users

class User(models.Model):
    user_id = models.CharField(max_length=100, unique=True)
    overall_GPA = models.DecimalField(max_digits=3, decimal_places=2)
    test_score = models.CharField(max_length=255, blank=True, help_text="SAT/ACT scores")
    english_proficiency = models.CharField(max_length=255, blank=True, help_text="IELTS/TOEIC/TOEFL scores")
    personal_statement = models.URLField(max_length=500, unique=True, help_text="Link of your personal statement")

    def __str__(self):
        return f"Overall GPA: {self.overall_GPA}\nTest Score: {self.test_score}\nEnglish Proficiency: {self.english_proficiency}"

class Transcript(models.Model):
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE,
        related_name='transcript'
    )
    course_name = models.CharField(max_length=255)
    credit_unit = models.PositiveIntegerField()
    course_GPA = models.DecimalField(max_digits=3, decimal_places=2)

    def __str__(self):
        return f"Course Name: {self.course_name}\nCredit Unit: {self.credit_unit}\nCourse GPA: {self.course_GPA}"
    
class Preference(models.Model):
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE,
        related_name='preference'
    )
    budget = models.DecimalField(max_digits=12, decimal_places=2)
    prefer_climate = models.CharField(max_length=255)
    prefer_location = models.CharField(max_length=255)

    def __str__(self):
        return f"Budget: {self.budget}\nPrefer Climate: {self.prefer_climate}\nPrefer Location: {self.prefer_location}"
    
# Schools

class School(models.Model):
    # Basic Info
    name = models.CharField(max_length=255)
    school_type = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=50)
    zipcode = models.CharField(max_length=20)
    
    # Unique Identifier
    school_id = models.CharField(max_length=100, unique=True)
    
    # Requirements
    test_scores_required = models.CharField(max_length=255, help_text="SAT/ACT requirements")
    english_proficiency_required = models.CharField(max_length=255, help_text="e.g. TOEFL 90+, IELTS 7.0")
    
    # Academics & Stats
    number_of_students = models.PositiveIntegerField()
    staff_student_rate = models.CharField(max_length=50, help_text="e.g. 1:15")
    gar = models.CharField(max_length=50, verbose_name="Graduation Acceptance Rate")
    
    # Miscellaneous
    climate = models.CharField(max_length=255)
    courses_and_classes = models.TextField()
    deadline_dates = models.TextField()
    scholarship_info = models.TextField()
    school_url = models.URLField(max_length=500)

    def __str__(self):
        return self.name

# Reversed the relationship between School and CostOfAttendance, School should be the parent and CostOfAttendance should be the child.
class CostOfAttendance(models.Model):
    school = models.OneToOneField(
        School, 
        on_delete=models.CASCADE,
        related_name='cost_of_attendance'
    )
    tuition = models.DecimalField(max_digits=12, decimal_places=2)
    living_expenses = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"Costs for {self.school.name}: Tuition: {self.tuition}, Living Expenses: {self.living_expenses}"