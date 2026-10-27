package httpapi

import (
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionKeepsOtherTabsCSRFTokensValid(t *testing.T) {
	request := func() *http.Request {
		r := httptest.NewRequest("GET", "https://mnemo.test/api/v1/session", nil)
		r.TLS = &tls.ConnectionState{VerifiedChains: [][]*x509.Certificate{{{Subject: pkix.Name{CommonName: "alice", OrganizationalUnit: []string{"mnemo-admin"}}}}}}
		return r
	}
	first := httptest.NewRecorder()
	Session(first, request())
	if first.Code != 200 {
		t.Fatal(first.Code)
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
		Admin     bool   `json:"admin"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &session); err != nil || !session.Admin {
		t.Fatal(session, err)
	}
	cookies := first.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatal("missing CSRF cookie")
	}
	cookie := cookies[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" {
		t.Fatal("unsafe session cookie")
	}
	secondRequest := request()
	secondRequest.AddCookie(cookie)
	second := httptest.NewRecorder()
	Session(second, secondRequest)
	var next map[string]any
	if err := json.Unmarshal(second.Body.Bytes(), &next); err != nil {
		t.Fatal(err)
	}
	if next["csrfToken"] != session.CSRFToken {
		t.Fatal("opening another tab invalidated the first tab")
	}
	writeRequest := request()
	writeRequest.AddCookie(second.Result().Cookies()[0])
	writeRequest.Header.Set("X-CSRF-Token", session.CSRFToken)
	if !CheckCSRF(writeRequest) {
		t.Fatal("first tab CSRF token rejected")
	}
}

func TestSSEFlushLimitsAndDisconnect(t *testing.T) {
	events := &Events{Heartbeat: time.Hour, MaxSubscribers: 1, QueueSize: 1}
	done := make(chan struct{}, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { events.ServeHTTP(w, r); done <- struct{}{} }))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", server.URL, nil)
	response, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	reader := bufio.NewReader(response.Body)
	line, err := reader.ReadString('\n')
	if err != nil || line != "event: refresh\n" {
		t.Fatal("initial frame not flushed", line, err)
	}
	// Drain data and blank separator before waiting for a committed invalidation.
	for i := 0; i < 2; i++ {
		if _, err = reader.ReadString('\n'); err != nil {
			t.Fatal(err)
		}
	}
	blocked, err := server.Client().Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	blocked.Body.Close()
	if blocked.StatusCode != 503 {
		t.Fatal("subscriber limit ignored", blocked.StatusCode)
	}
	<-done // rejected subscriber completed
	events.Notify()
	line, err = reader.ReadString('\n')
	if err != nil || line != "event: refresh\n" {
		t.Fatal("notification not flushed", line, err)
	}
	cancel()
	response.Body.Close()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stream did not stop on request cancellation")
	}
	events.mu.Lock()
	defer events.mu.Unlock()
	if len(events.subscribers) != 0 {
		t.Fatal("disconnected subscriber retained")
	}
}
