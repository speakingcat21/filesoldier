# Security Policy

## Supported Versions

FileSoldier is currently in active development. Security updates are provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Architecture

FileSoldier is built with security as a core principle:

- **End-to-End Encryption**: All files are encrypted client-side using AES-256-GCM before upload
- **Zero-Knowledge Architecture**: The server never has access to encryption keys or decrypted file contents
- **Client-Side Key Generation**: Encryption keys are generated in the browser and never transmitted to servers
- **Secure Key Delivery**: Decryption keys are shared via URL fragments (#), which are never sent to servers

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report vulnerabilities by:

1. **Email**: Send details to [your-email@example.com] with subject "FileSoldier Security Vulnerability"
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Updates**: We will keep you informed of our progress
- **Resolution**: We aim to resolve critical vulnerabilities within 7 days
- **Credit**: With your permission, we will credit you in the security advisory

### Scope

The following are in scope for security reports:

- Encryption/decryption vulnerabilities
- Authentication bypass
- Data leakage or privacy issues
- Cross-site scripting (XSS)
- SQL injection
- Server-side request forgery (SSRF)
- Access control issues
- Cryptographic weaknesses

### Out of Scope

- Denial of Service (DoS) attacks
- Social engineering
- Physical security
- Issues in third-party dependencies (report these upstream)

## Security Best Practices for Users

1. **Use strong passwords** when password-protecting files
2. **Share links securely** - use encrypted messaging apps rather than email when possible
3. **Enable burn-after-read** for highly sensitive files
4. **Set expiry times** appropriate to your needs
5. **Verify the URL** - always ensure you're on the official FileSoldier domain

## Security Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

*No vulnerabilities reported yet.*

---

Thank you for helping keep FileSoldier and its users safe! 🔐
