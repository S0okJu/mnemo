package connection

import (
	"bytes"
	"encoding/base64"
	"testing"
)

func TestVault(t *testing.T) {
	v, err := NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	if err != nil {
		t.Fatal(err)
	}
	secret := []byte("sensitive kubeconfig")
	a := v.Seal(secret, []byte("1"))
	b := v.Seal(secret, []byte("1"))
	if bytes.Equal(a, b) || bytes.Contains(a, secret) {
		t.Fatal("ciphertexts must be randomized and opaque")
	}
	got, err := v.Open(a, []byte("1"))
	if err != nil || !bytes.Equal(got, secret) {
		t.Fatal("roundtrip failed", err)
	}
	if _, err = v.Open(a, []byte("2")); err == nil {
		t.Fatal("generation substitution accepted")
	}
	a[len(a)-1] ^= 1
	if _, err = v.Open(a, []byte("1")); err == nil {
		t.Fatal("tampering accepted")
	}
	if _, err = NewVault("bad"); err == nil {
		t.Fatal("invalid key accepted")
	}
}
