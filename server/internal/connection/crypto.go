package connection

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
)

// Vault binds ciphertext to its connection generation using authenticated data.
type Vault struct{ aead cipher.AEAD }

func NewVault(encoded string) (*Vault, error) {
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) != 32 {
		return nil, errors.New("MNEMO_ENCRYPTION_KEY must be base64 encoding of 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Vault{aead}, nil
}

func (v *Vault) Seal(plaintext, identity []byte) []byte {
	nonce := make([]byte, v.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		panic(err)
	}
	return v.aead.Seal(nonce, nonce, plaintext, identity)
}

func (v *Vault) Open(blob, identity []byte) ([]byte, error) {
	n := v.aead.NonceSize()
	if len(blob) < n {
		return nil, errors.New("invalid encrypted connection")
	}
	return v.aead.Open(nil, blob[:n], blob[n:], identity)
}
