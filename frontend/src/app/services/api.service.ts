import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import {
  API_BASE,
  LoginRequest,
  LoginResponse,
  UserInfo,
  Topic,
  TopicListResponse,
  TopicDetailResponse,
  CreateTopicRequest,
  UpdateTopicRequest,
  ProcessTopicRequest,
  ProcessTopicRequest as PReq,
  BatchProcessRequest,
  BatchProcessResponse,
  StatisticsResponse,
  Attachment,
  AttachmentInput,
  ApiError,
} from '../models';

const TOKEN_KEY = 'news_editorial_token';
const USER_KEY = 'news_editorial_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user$ = new BehaviorSubject<UserInfo | null>(null);
  user$ = this._user$.asObservable();

  constructor(private http: HttpClient) {
    const u = localStorage.getItem(USER_KEY);
    if (u) {
      try {
        this._user$.next(JSON.parse(u));
      } catch {}
    }
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get currentUser(): UserInfo | null {
    return this._user$.value;
  }

  get isLoggedIn(): boolean {
    return !!this.token && !!this._user$.value;
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE}/auth/login`, req)
      .pipe(
        tap((r) => {
          localStorage.setItem(TOKEN_KEY, r.token);
          localStorage.setItem(USER_KEY, JSON.stringify(r.user));
          this._user$.next(r.user);
        }),
        catchError(handleError)
      );
  }

  me(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${API_BASE}/auth/me`).pipe(
      tap((u) => {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        this._user$.next(u);
      }),
      catchError(handleError)
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user$.next(null);
  }

  authHeaders(): HttpHeaders {
    const t = this.token;
    if (!t) return new HttpHeaders();
    return new HttpHeaders().set('Authorization', `Bearer ${t}`);
  }

  switchUser(user: UserInfo, token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user$.next(user);
  }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  list(): Observable<UserInfo[]> {
    return this.http
      .get<UserInfo[]>(`${API_BASE}/users`, { headers: this.auth.authHeaders() })
      .pipe(catchError(handleError));
  }
}

@Injectable({ providedIn: 'root' })
export class TopicService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  list(params: {
    status?: string;
    category?: string;
    priority?: string;
    keyword?: string;
    page?: number;
    page_size?: number;
    warning?: string;
  } = {}): Observable<TopicListResponse> {
    let httpParams = new HttpParams();
    (Object.keys(params) as (keyof typeof params)[]).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    });
    return this.http
      .get<TopicListResponse>(`${API_BASE}/topics`, {
        headers: this.auth.authHeaders(),
        params: httpParams,
      })
      .pipe(catchError(handleError));
  }

  detail(id: string): Observable<TopicDetailResponse> {
    return this.http
      .get<TopicDetailResponse>(`${API_BASE}/topics/${id}`, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  create(req: CreateTopicRequest): Observable<Topic> {
    return this.http
      .post<Topic>(`${API_BASE}/topics`, req, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  update(id: string, req: UpdateTopicRequest): Observable<Topic> {
    return this.http
      .put<Topic>(`${API_BASE}/topics/${id}`, req, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  process(
    id: string,
    req: ProcessTopicRequest
  ): Observable<{ topic: Topic; action: string }> {
    return this.http
      .post<{ topic: Topic; action: string }>(`${API_BASE}/topics/${id}/process`, req, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  batch(req: BatchProcessRequest): Observable<BatchProcessResponse> {
    return this.http
      .post<BatchProcessResponse>(`${API_BASE}/topics/batch/process`, req, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  uploadAttachment(id: string, input: AttachmentInput): Observable<Attachment> {
    return this.http
      .post<Attachment>(`${API_BASE}/topics/${id}/attachments`, input, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  deleteAttachment(id: string, aid: string): Observable<void> {
    return this.http
      .delete<void>(`${API_BASE}/topics/${id}/attachments/${aid}`, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }

  statistics(): Observable<StatisticsResponse> {
    return this.http
      .get<StatisticsResponse>(`${API_BASE}/statistics`, {
        headers: this.auth.authHeaders(),
      })
      .pipe(catchError(handleError));
  }
}

function handleError(err: HttpErrorResponse): Observable<never> {
  let apiErr: ApiError;
  if (err.error && typeof err.error === 'object') {
    apiErr = {
      code: err.error.code || `HTTP_${err.status}`,
      message: err.error.message || err.message,
      detail: err.error.detail || null,
    };
  } else if (typeof err.error === 'string') {
    try {
      const parsed = JSON.parse(err.error);
      apiErr = {
        code: parsed.code || `HTTP_${err.status}`,
        message: parsed.message || err.message,
        detail: parsed.detail || null,
      };
    } catch {
      apiErr = {
        code: `HTTP_${err.status}`,
        message: err.error || err.message,
        detail: null,
      };
    }
  } else {
    apiErr = {
      code: `HTTP_${err.status}`,
      message: err.message || '未知错误',
      detail: null,
    };
  }
  return throwError(() => apiErr);
}
