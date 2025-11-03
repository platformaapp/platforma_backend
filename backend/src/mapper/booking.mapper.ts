import { Injectable } from '@nestjs/common';
import { Slot } from 'src/slots/entities/slot.entity';
import { Booking } from 'src/student/entities/booking.entity';
import { User } from 'src/users/user.entity';
import { BookingDetails } from 'src/utils/types';
import { Session, SessionStatus } from '../session/entities/session.entity';

@Injectable()
export class BookingMapper {
  mapToBookingDetails(booking: Booking): BookingDetails {
    return {
      id: booking.id,
      slotId: booking.slotId,
      tutorId: booking.tutorId,
      studentId: booking.studentId,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      slot: booking.slot
        ? {
            id: booking.slot.id,
            date: booking.slot.date,
            time: booking.slot.time,
          }
        : undefined,
      student: booking.student
        ? {
            id: booking.student.id,
            fullName: booking.student.fullName,
            email: booking.student.email,
          }
        : undefined,
      tutor: booking.tutor
        ? {
            id: booking.tutor.id,
            fullName: booking.tutor.fullName,
            email: booking.tutor.email,
          }
        : undefined,
    };
  }

  mapToBookingDetailsList(bookings: Booking[]): BookingDetails[] {
    return bookings.map((booking) => this.mapToBookingDetails(booking));
  }

  mapToResponseDto(booking: Booking, slot?: Slot, student?: User, tutor?: User): BookingDetails {
    const result: BookingDetails = {
      id: booking.id,
      slotId: booking.slotId,
      tutorId: booking.tutorId,
      studentId: booking.studentId,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };

    const slotData = slot || booking.slot;
    if (slotData) {
      result.slot = {
        id: slotData.id,
        date: slotData.date,
        time: slotData.time,
      };

      const slotWithTutor = slotData as Slot & { tutor?: User };
      const tutorData = tutor || slotWithTutor.tutor || booking.tutor;
      if (tutorData) {
        result.slot.tutor = {
          id: tutorData.id,
          fullName: tutorData.fullName,
          email: tutorData.email,
        };
        result.tutor = result.slot.tutor;
      }
    }

    const studentData = student || booking.student;
    if (studentData) {
      result.student = {
        id: studentData.id,
        fullName: studentData.fullName,
        email: studentData.email,
      };
    }

    return result;
  }

  mapToBookingWithSession(
    booking: Booking,
    slot: Slot,
    student: User,
    tutor: User,
    session: Session
  ): BookingDetails {
    return {
      id: booking.id,
      slotId: booking.slotId,
      tutorId: booking.tutorId,
      studentId: booking.studentId,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      slot: {
        id: slot.id,
        date: slot.date,
        time: slot.time,
        tutor: {
          id: tutor.id,
          fullName: tutor.fullName,
          email: tutor.email,
        },
      },
      student: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
      },
      tutor: {
        id: tutor.id,
        fullName: tutor.fullName,
        email: tutor.email,
      },
      sessionInfo: {
        sessionId: session.id,
        price: session.price,
        requiresPayment: session.status === SessionStatus.PLANNED,
      },
    };
  }
}
