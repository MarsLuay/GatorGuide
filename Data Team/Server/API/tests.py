from rest_framework import status
from rest_framework.test import APITestCase

from .models import CostOfAttendance, School, Transcript, User


class UserApiTests(APITestCase):
    def test_create_read_update_and_delete_user_with_nested_data(self):
        payload = {
            "user_id": "student-001",
            "overall_GPA": "3.85",
            "test_score": "SAT 1270",
            "english_proficiency": "TOEFL 102",
            "personal_statement": "https://example.com/personal-statement/student-001",
            "transcript": {
                "course_name": "ENG101",
                "credit_unit": 5,
                "course_GPA": "3.70",
            },
            "preference": {
                "budget": "18000.00",
                "prefer_climate": "Temperate",
                "prefer_location": "Pacific Northwest",
            },
        }

        create_response = self.client.post("/api/write/users/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Transcript.objects.count(), 1)
        self.assertEqual(create_response.data["transcript"]["course_name"], "ENG101")
        self.assertEqual(create_response.data["preference"]["prefer_location"], "Pacific Northwest")

        detail_response = self.client.get("/api/read/users/student-001/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["user_id"], "student-001")
        self.assertEqual(detail_response.data["transcript"]["credit_unit"], 5)

        patch_response = self.client.patch(
            "/api/write/users/student-001/",
            {
                "overall_GPA": "3.92",
                "transcript": {
                    "course_name": "MATH&146",
                    "credit_unit": 5,
                    "course_GPA": "3.95",
                },
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["overall_GPA"], "3.92")
        self.assertEqual(patch_response.data["transcript"]["course_name"], "MATH&146")

        list_response = self.client.get("/api/read/users/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        delete_response = self.client.delete("/api/write/users/student-001/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(user_id="student-001").exists())

        missing_response = self.client.get("/api/read/users/student-001/")
        self.assertEqual(missing_response.status_code, status.HTTP_404_NOT_FOUND)


class SchoolApiTests(APITestCase):
    def setUp(self):
        self.green_river = School.objects.create(
            name="Green River College",
            school_type="Public",
            address="12401 SE 320th St",
            city="Auburn",
            state="WA",
            zipcode="98092",
            school_id="GRC-001",
            test_scores_required="Optional",
            english_proficiency_required="TOEFL 70+",
            number_of_students=7400,
            staff_student_rate="1:18",
            gar="45%",
            climate="Temperate",
            courses_and_classes="Computer Science; Engineering",
            deadline_dates="Priority: Feb 1",
            scholarship_info="Foundation scholarship available",
            school_url="https://www.greenriver.edu/",
        )
        CostOfAttendance.objects.create(
            school=self.green_river,
            tuition="12450.00",
            living_expenses="9800.00",
        )

        self.bellevue = School.objects.create(
            name="Bellevue College",
            school_type="Public",
            address="3000 Landerholm Cir SE",
            city="Bellevue",
            state="WA",
            zipcode="98007",
            school_id="BC-001",
            test_scores_required="Optional",
            english_proficiency_required="TOEFL 70+",
            number_of_students=11000,
            staff_student_rate="1:19",
            gar="48%",
            climate="Temperate",
            courses_and_classes="Business; Nursing",
            deadline_dates="Final: Apr 1",
            scholarship_info="Multiple transfer scholarships",
            school_url="https://www.bellevuecollege.edu/",
        )

    def test_get_schools_supports_filters_and_detail(self):
        all_response = self.client.get("/api/read/schools/")
        self.assertEqual(all_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(all_response.data), 2)

        search_response = self.client.get("/api/read/schools/?q=green")
        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(search_response.data), 1)
        self.assertEqual(search_response.data[0]["school_id"], "GRC-001")

        filtered_response = self.client.get("/api/read/schools/?state=WA&school_type=public&climate=temper")
        self.assertEqual(filtered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered_response.data), 2)

        detail_response = self.client.get("/api/read/schools/GRC-001/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["name"], "Green River College")
        self.assertEqual(detail_response.data["cost_of_attendance"]["tuition"], "12450.00")

        missing_response = self.client.get("/api/read/schools/NOPE-404/")
        self.assertEqual(missing_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_update_and_delete_school_with_cost_data(self):
        payload = {
            "name": "University of Washington Tacoma",
            "school_type": "Public",
            "address": "1900 Commerce St",
            "city": "Tacoma",
            "state": "WA",
            "zipcode": "98402",
            "school_id": "UWT-001",
            "test_scores_required": "Not required",
            "english_proficiency_required": "TOEFL 83+",
            "number_of_students": 5600,
            "staff_student_rate": "1:17",
            "gar": "62%",
            "climate": "Marine west coast",
            "courses_and_classes": "Computer Science; Education; Business",
            "deadline_dates": "Priority: Jan 15",
            "scholarship_info": "Transfer merit scholarship",
            "school_url": "https://www.tacoma.uw.edu/",
            "cost_of_attendance": {
                "tuition": "13800.00",
                "living_expenses": "11200.00",
            },
        }

        create_response = self.client.post("/api/write/schools/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(School.objects.filter(school_id="UWT-001").exists())
        self.assertEqual(create_response.data["cost_of_attendance"]["living_expenses"], "11200.00")

        patch_response = self.client.patch(
            "/api/write/schools/UWT-001/",
            {
                "deadline_dates": "Priority: Jan 10",
                "cost_of_attendance": {
                    "tuition": "14050.00",
                    "living_expenses": "11300.00",
                },
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["deadline_dates"], "Priority: Jan 10")
        self.assertEqual(patch_response.data["cost_of_attendance"]["tuition"], "14050.00")

        delete_response = self.client.delete("/api/write/schools/UWT-001/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(School.objects.filter(school_id="UWT-001").exists())
