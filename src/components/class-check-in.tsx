"use client";

import { useState } from "react";
import { FaceVerify } from "@/components/face-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle, Clock, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { CalendarRequest } from "@/lib/types";

interface ClassCheckInProps {
  event: CalendarRequest;
  studentId: string;
  onAttendanceMarked?: (data: any) => void;
}

export function ClassCheckIn({ event, studentId, onAttendanceMarked }: ClassCheckInProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAttended, setHasAttended] = useState(false);

  const handleFaceVerifySuccess = (data: any) => {
    setHasAttended(true);
    setIsOpen(false);
    onAttendanceMarked?.(data);
  };

  const eventStart = event.start_time.slice(0, 5);
  const eventEnd = event.end_time.slice(0, 5);
  const eventDate = format(new Date(event.event_date), "MMM d, yyyy");

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500" />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{event.title}</CardTitle>
            {event.description && (
              <CardDescription className="mt-1">{event.description}</CardDescription>
            )}
          </div>
          {hasAttended && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Attended
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{eventStart} - {eventEnd}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{eventDate}</span>
        </div>

        {event.classroom && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{event.classroom.name}</span>
          </div>
        )}

        {event.student_groups && event.student_groups.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-[11px] font-medium uppercase">Groups:</span>
            <div className="flex flex-wrap gap-1">
              {event.student_groups.map((sg) => (
                <Badge key={sg.id} variant="secondary" className="text-xs">
                  {sg.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!hasAttended && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <Button className="w-full gap-2 mt-4" onClick={() => setIsOpen(true)}>
              <Camera className="h-4 w-4" />
              Check In with Face
            </Button>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Face Verification Check-in</DialogTitle>
                <DialogDescription>
                  Verify your attendance for <strong>{event.title}</strong> by capturing your face
                </DialogDescription>
              </DialogHeader>
              <FaceVerify
                studentId={studentId}
                calendarRequestId={event.id}
                classroomId={event.classroom_id}
                onSuccess={handleFaceVerifySuccess}
              />
            </DialogContent>
          </Dialog>
        )}

        {hasAttended && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <p className="font-medium">✓ Your attendance has been verified and recorded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export a modal version for quick check-in from any page
interface ClassCheckInModalProps {
  event: CalendarRequest;
  studentId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAttendanceMarked?: (data: any) => void;
}

export function ClassCheckInModal({
  event,
  studentId,
  isOpen,
  onOpenChange,
  onAttendanceMarked,
}: ClassCheckInModalProps) {
  const handleSuccess = (data: any) => {
    onOpenChange(false);
    onAttendanceMarked?.(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Class Check-in: {event.title}</DialogTitle>
          <DialogDescription>
            Verify your attendance by capturing your face. This must be done during class time at {event.start_time.slice(0, 5)}
          </DialogDescription>
        </DialogHeader>
        <FaceVerify
          studentId={studentId}
          calendarRequestId={event.id}
          classroomId={event.classroom_id}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
