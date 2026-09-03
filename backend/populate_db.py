import os
import sys
import django
from datetime import date, timedelta
import random

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sales_project.settings')
django.setup()

from sales.models import Enquiry, Appointment, Feedback

def populate_db():
    print("Clearing existing data...")
    Enquiry.objects.all().delete()
    Appointment.objects.all().delete()
    Feedback.objects.all().delete()

    customers = [
        "Rithwik", "Siva", "Raja", "Vadivelu", "Naveen", 
        "Kesavan", "Rathish", "Anitha", "Deepa", "Mohan",
        "Divya", "Arjun", "Sneha", "Karthik", "Priya",
        "Rajesh", "Meera", "Vikram", "Neha", "Sanjay"
    ]
    
    vehicles = ["Fascino", "FZ-S", "RayZR", "MT-15", "XSR", "FZ-X", "R15", "Aerox"]
    temperatures = ["Hot", "Warm", "Cold"]
    enquiry_statuses = ["New Lead", "In Progress", "Submitted", "Draft", "Closed"]
    appointment_statuses = ["Scheduled", "Completed", "Cancelled", "Pending"]
    feedback_statuses = ["Draft", "Submitted"] # No feedback text/rating in model, just status
    sources = ["Walk-in", "Phone", "Website", "Referral", "Social Media"]
    times = ["10:00 AM", "11:30 AM", "01:00 PM", "02:45 PM", "04:30 PM", "05:15 PM"]

    print("Creating 20 Enquiries...")
    enquiries = []
    base_date = date.today() - timedelta(days=30)
    
    for i in range(1, 21):
        enq = Enquiry.objects.create(
            enquiry_id=f"ENQ00{i}" if i < 10 else f"ENQ0{i}",
            customer=customers[i-1],
            vehicle=random.choice(vehicles),
            temperature=random.choice(temperatures),
            status=random.choice(enquiry_statuses),
            date=base_date + timedelta(days=random.randint(0, 30)),
            source=random.choice(sources)
        )
        enquiries.append(enq)

    print("Creating 15 Appointments...")
    appointments = []
    for i in range(1, 16):
        # Link loosely to an enquiry (though not strictly FK in this model)
        linked_enq = random.choice(enquiries)
        app = Appointment.objects.create(
            appointment_id=f"APP00{i}" if i < 10 else f"APP0{i}",
            customer=linked_enq.customer,
            vehicle=linked_enq.vehicle,
            status=random.choice(appointment_statuses),
            date=linked_enq.date + timedelta(days=random.randint(1, 10)),
            time=random.choice(times)
        )
        appointments.append(app)

    print("Creating 15 Feedbacks...")
    feedbacks = []
    feedback_comments = [
        "Great experience, very professional staff.",
        "The vehicle was delivered on time, happy with the service.",
        "Could have been a bit faster with the paperwork.",
        "Sales executive was very knowledgeable about the features.",
        "Good overall, but wait time was slightly long.",
        "Excellent support and test drive experience.",
        "Satisfied with the purchase process.",
        "The showroom ambiance was nice, but follow-up was slow.",
        "Amazing vehicle, and the team was very helpful.",
        "Fair experience, nothing extraordinary."
    ]

    for i in range(1, 16):
        linked_enq = random.choice(enquiries)
        status_choice = random.choice(feedback_statuses)
        rating_val = random.randint(1, 5) if status_choice == "Submitted" else 0
        text_val = random.choice(feedback_comments) if status_choice == "Submitted" else ""

        fb = Feedback.objects.create(
            feedback_id=f"FB00{i}" if i < 10 else f"FB0{i}",
            enquiry_id=linked_enq.enquiry_id,
            customer=linked_enq.customer,
            vehicle=linked_enq.vehicle,
            status=status_choice,
            date=linked_enq.date + timedelta(days=random.randint(5, 20)),
            rating=rating_val,
            feedback_text=text_val
        )
        feedbacks.append(fb)

    print(f"Successfully added {len(enquiries)} enquiries, {len(appointments)} appointments, and {len(feedbacks)} feedbacks!")

if __name__ == '__main__':
    populate_db()
