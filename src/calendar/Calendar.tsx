import React, { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  momentLocalizer,
  SlotInfo,
  Event as BigCalendarEvent,
} from "react-big-calendar";
import moment from "moment";
import { gapi } from "gapi-script";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/pl";

const localizer = momentLocalizer(moment);

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime: string;
  };
  end: {
    dateTime: string;
  };
}

interface MyEvent extends BigCalendarEvent {
  id: string;
}

const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
console.log(CLIENT_ID);
const API_KEY = process.env.REACT_APP_API_KEY;
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
];
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

const GoogleCalendar: React.FC = () => {
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const mapGoogleEventsToCalendarEvents = useCallback(
    (googleEvents: GoogleCalendarEvent[]) => {
      return googleEvents.map((event) => ({
        id: event.id,
        title: event.summary,
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
      }));
    },
    []
  );

  const listUpcomingEvents = useCallback(() => {
    gapi.client.calendar.events
      .list({
        calendarId: "primary",
        timeMin: new Date().toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: "startTime",
      })
      .then((response: any) => {
        const googleEvents = response.result.items;
        const calendarEvents = mapGoogleEventsToCalendarEvents(googleEvents);
        setEvents(calendarEvents); // Usuń wolne sloty, ustaw tylko wydarzenia
      });
  }, [mapGoogleEventsToCalendarEvents]);

  useEffect(() => {
    const initClient = () => {
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES,
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          setIsSignedIn(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen(setIsSignedIn);

          if (authInstance.isSignedIn.get()) {
            listUpcomingEvents();
          }
        });
    };

    gapi.load("client:auth2", initClient);
  }, [listUpcomingEvents]);

  const handleSignInClick = () => {
    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance) {
      authInstance.signIn();
    } else {
      console.error("GAPI nie jest jeszcze gotowe. Spróbuj ponownie.");
    }
  };

  const handleSignOutClick = () => {
    gapi.auth2.getAuthInstance().signOut();
    setEvents([]);
  };

  const createGoogleCalendarEvent = async (newEvent: MyEvent) => {
    if (!newEvent.start || !newEvent.end) {
      console.error("Brak daty rozpoczęcia lub zakończenia dla wydarzenia");
      return;
    }

    try {
      const response = await gapi.client.calendar.events.insert({
        calendarId: "primary",
        resource: {
          summary: newEvent.title, // Używamy tytułu podanego przez użytkownika
          start: {
            dateTime: newEvent.start.toISOString(), // Start wybranego slotu
            timeZone: "Europe/Warsaw",
          },
          end: {
            dateTime: newEvent.end.toISOString(), // Koniec wybranego slotu
            timeZone: "Europe/Warsaw",
          },
        },
      });

      console.log("Wydarzenie dodane do Google Calendar:", response);
      return response.result;
    } catch (error) {
      console.error(
        "Błąd podczas dodawania wydarzenia do Google Calendar:",
        error
      );
      throw error;
    }
  };

  const handleSelectSlot = async (slotInfo: SlotInfo) => {
    const title = window.prompt("Podaj nazwę wydarzenia");

    // Jeśli użytkownik podał tytuł i istnieją godziny startu i zakończenia
    if (title && slotInfo.start && slotInfo.end) {
      const newEvent: MyEvent = {
        id: Math.random().toString(),
        title,
        start: slotInfo.start,
        end: slotInfo.end,
      };

      try {
        // Dodaj wydarzenie do Google Calendar
        const googleEvent = await createGoogleCalendarEvent(newEvent);

        // Aktualizuj stan wydarzeń w kalendarzu
        setEvents((prevEvents) => [
          ...prevEvents,
          {
            id: googleEvent.id,
            title: googleEvent.summary,
            start: new Date(googleEvent.start.dateTime),
            end: new Date(googleEvent.end.dateTime),
          },
        ]);
      } catch (error) {
        console.error(
          "Błąd podczas dodawania wydarzenia do Google Calendar:",
          error
        );
        alert("Nie udało się dodać wydarzenia. Spróbuj ponownie.");
      }
    }
  };

  return (
    <div>
      <h2>Kalendarz Google</h2>
      {isSignedIn ? (
        <div>
          <button onClick={handleSignOutClick}>Wyloguj</button>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            selectable
            onSelectSlot={handleSelectSlot} // Pozwala na dodawanie wydarzeń po kliknięciu
            style={{ height: 500, margin: "50px" }}
            min={new Date(1970, 1, 1, 8, 0, 0)} // Zaczynaj od 8:00
            max={new Date(1970, 1, 1, 16, 0, 0)} // Kończ o 16:00
          />
        </div>
      ) : (
        <button onClick={handleSignInClick}>Zaloguj się przez Google</button>
      )}
    </div>
  );
};

export default GoogleCalendar;
