from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class TeamBooking(db.Model):
    __tablename__ = 'team_bookings'

    id = db.Column(db.Integer, primary_key=True)
    booking_no = db.Column(db.String(50), unique=True, nullable=False)
    team_name = db.Column(db.String(200), nullable=False)
    contact_person = db.Column(db.String(50), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    visitor_count = db.Column(db.Integer, nullable=False)
    visit_date = db.Column(db.Date, nullable=False)
    visit_time = db.Column(db.String(20))
    status = db.Column(db.String(20), nullable=False, default='待审核')
    current_handler = db.Column(db.String(50), default='现场调度')
    current_role = db.Column(db.String(50), default='dispatcher')
    version = db.Column(db.Integer, default=1)
    deadline = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team_booking_info = db.relationship('BookingInfo', backref='team_booking', uselist=False, cascade='all, delete-orphan')
    ticket_verification = db.relationship('TicketVerification', backref='team_booking', uselist=False, cascade='all, delete-orphan')
    entry_statistics = db.relationship('EntryStatistics', backref='team_booking', uselist=False, cascade='all, delete-orphan')
    attachments = db.relationship('Attachment', backref='team_booking', cascade='all, delete-orphan')
    processing_records = db.relationship('ProcessingRecord', backref='team_booking', cascade='all, delete-orphan')
    audit_notes = db.relationship('AuditNote', backref='team_booking', cascade='all, delete-orphan')
    exception_reasons = db.relationship('ExceptionReason', backref='team_booking', cascade='all, delete-orphan')


class BookingInfo(db.Model):
    __tablename__ = 'booking_info'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    itinerary = db.Column(db.Text)
    requirements = db.Column(db.Text)
    submitted_by = db.Column(db.String(50))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_complete = db.Column(db.Boolean, default=False)


class TicketVerification(db.Model):
    __tablename__ = 'ticket_verification'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    ticket_count = db.Column(db.Integer, default=0)
    verified_count = db.Column(db.Integer, default=0)
    ticket_type = db.Column(db.String(50))
    verified_by = db.Column(db.String(50))
    verified_at = db.Column(db.DateTime)
    is_complete = db.Column(db.Boolean, default=False)


class EntryStatistics(db.Model):
    __tablename__ = 'entry_statistics'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    actual_entry_count = db.Column(db.Integer, default=0)
    entry_time = db.Column(db.DateTime)
    exit_time = db.Column(db.DateTime)
    recorded_by = db.Column(db.String(50))
    recorded_at = db.Column(db.DateTime)
    is_complete = db.Column(db.Boolean, default=False)


class Attachment(db.Model):
    __tablename__ = 'attachments'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))
    file_path = db.Column(db.String(500))
    module = db.Column(db.String(50))
    uploaded_by = db.Column(db.String(50))
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)


class ProcessingRecord(db.Model):
    __tablename__ = 'processing_records'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    from_status = db.Column(db.String(20))
    to_status = db.Column(db.String(20))
    operator = db.Column(db.String(50), nullable=False)
    operator_role = db.Column(db.String(50), nullable=False)
    remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AuditNote(db.Model):
    __tablename__ = 'audit_notes'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    note = db.Column(db.Text, nullable=False)
    author = db.Column(db.String(50), nullable=False)
    author_role = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ExceptionReason(db.Model):
    __tablename__ = 'exception_reasons'

    id = db.Column(db.Integer, primary_key=True)
    team_booking_id = db.Column(db.Integer, db.ForeignKey('team_bookings.id'), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50))
    reporter = db.Column(db.String(50))
    reporter_role = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
