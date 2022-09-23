create TABLE users(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

create TABLE cars(
    id SERIAL PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    number_plate VARCHAR(255) UNIQUE NOT NULL,
    isBooking BOOLEAN DEFAULT false
);

create TABLE booking_cars(
     id SERIAL PRIMARY KEY,
     booking_start date NOT NULL,
     booking_end date NOT NULL,
     total_cost INTEGER NOT NULL,
     car_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     FOREIGN KEY (car_id) REFERENCES cars (id),
     FOREIGN KEY (user_id) REFERENCES users (id)
);