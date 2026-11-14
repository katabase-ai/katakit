import { Observable } from 'rxjs';

export type InferObservableValue<T extends Observable<unknown>> =
  T extends Observable<infer U> ? U : never;
