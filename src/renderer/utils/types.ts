import { Subject } from 'rxjs';

export interface Monitor {
  watch(events: Event[]): void;
  unwatch(events: string[]): void;
  ignoreFiles(eventToIgnore: Event[], ignoredFilepath: string[]): void;
  closeAll(): void;
  getEvents(): Event[];
  getEventsWatching(): Event[];
  getSubject(): Subject<[Event, string]>;
}

export type Event = 'unlink' | 'unlinkDir' | 'add' | 'addDir' | 'change' | 'error';
