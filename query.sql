-- To Create user table
CREATE TABLE users (
	id serial primary key,
	user_name text not null unique,
	password text not null,
	email text not null,
	firstname text not null,
	lastname text
);

--Create my library table
CREATE TABLE my_library (
	uid serial,
	id int REFERENCES users(id) ON DELETE CASCADE,
	book_id text,
	primary key(id, book_id)
);

--Create notes table
CREATE TABLE notes (
	uid serial PRIMARY KEY,
	id int not null,
	book_id text not null,
	note_title text,
	note text
);
--To Insert users manually
INSERT INTO users (user_name, password) VALUES ('admin', 'admin'), ('test', 'test');

--To Insert books manually
INSERT INTO my_library VALUES (1, 'OL82563W'), (1, 'OL82537W'), (1, 'OL82548W'), (1, 'OL257943W'), (2, 'OL5753057W'), (2, 'OL8215148W'), (2, 'OL8215149W'), (2, 'OL13268171W');