# Backend Foundation Documentation Index — 3JATA Backend

The Backend Foundation establishes the secure, production-structured Node.js + Express 5 + Mongoose 9 backend for **3JATA** (Organic Fruit, Vegetable, and Herbal Powders).

## Architecture Convention
Every module follows the layered CommonJS flow:

`routes -> middleware -> validators -> controllers -> services -> models`

- **Base URL:** `http://localhost:5000/api`
- **Success Envelope:** `{ "success": true, "message": "...", "data": ... }`
- **Error Envelope:** `{ "success": false, "message": "...", "errors": [] }`

## Module Guides
1. [Project Audit](project-audit.md)
2. [Backend Standards](backend-standards.md)
3. [Authentication](authentication.md)
4. [Roles and Staff Access](roles-and-staff-access.md)
5. [Product Catalogue](product-catalogue.md)
6. [Inventory Management](inventory-management.md)
7. [Testing and Verification](testing-and-verification.md)

## API & Postman Documentation
- [API Endpoint Index](api-endpoint-index.md)
- [Manual Postman Testing Guide](manual-postman-testing.md)
- [Manual Test Results](manual-test-results.md)
- [OpenAPI 3.0 Spec](../api/openapi.yaml)
- [Postman Collection (v2.1)](../../postman/3JATA-Backend-Foundation.postman_collection.json)
- [Postman Local Environment](../../postman/3JATA-local.postman_environment.json)
