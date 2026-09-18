Organic Powder — System Architecture
1. Purpose

This document explains the high-level architecture of the Organic Powder platform.

The architecture is designed to keep the application simple, modular and maintainable while allowing the system to grow as the business grows.

2. Architecture Approach

The initial application will use a Modular Monolith architecture.

The platform will have one main backend application, but its code will be organised into separate modules based on business responsibilities.

This approach keeps the project easier to develop and maintain without introducing unnecessary complexity.

3. High-Level Architecture
                         Users
                           |
             ┌─────────────┴─────────────┐
             |                           |
             ↓                           ↓
      Customer Application          Admin Portal
             |                           |
             └─────────────┬─────────────┘
                           ↓
                    Express REST API
                           |
                    Authentication
                           |
                         RBAC
                           |
             ┌─────────────┼─────────────┐
             |             |             |
             ↓             ↓             ↓
         Customer       Business        Admin
          Modules        Modules       Modules
             |             |             |
             └─────────────┼─────────────┘
                           ↓
                        MongoDB
4. Frontend

The customer application will use:

React
Vite
Tailwind CSS
React Router
Zustand
TanStack Query

The frontend will be responsible for:

Displaying the user interface.
Managing customer interactions.
Handling client-side state.
Calling backend APIs.
Displaying loading and error states.
Providing responsive layouts.
Protecting the user experience based on authentication and permissions.

Frontend permission checks are only for user experience.

The backend remains responsible for real authorization.

5. Admin Portal

The admin portal will be part of the same overall frontend system or closely connected frontend application.

The portal will provide different modules based on the logged-in staff member's permissions.

Possible modules include:

Dashboard
Products
Inventory
Orders
Shipping
Marketing
Finance
Customers
Support
Content
AI
Analytics
Procurement
Audit Logs
Settings

A Product Manager should not automatically receive access to Finance operations.

The backend will enforce these permissions.

6. Backend

The backend will use:

Node.js
Express.js
REST APIs
Mongoose
MongoDB

The backend will contain separate modules for business responsibilities.

Examples include:

Authentication
Users
Products
Categories
Cart
Wishlist
Orders
Payments
Refunds
Coupons
Reviews
Inventory
Shipping
Support
Notifications
Content
Analytics
AI
Procurement
Admin
7. Backend Request Flow

A typical request will follow a structure similar to:

Frontend
   ↓
HTTP Request
   ↓
Express Router
   ↓
Authentication Middleware
   ↓
Permission Middleware
   ↓
Validation
   ↓
Controller
   ↓
Service / Business Logic
   ↓
Database / External Service
   ↓
Response
   ↓
Frontend

This keeps authentication, authorization, validation and business logic separated.

8. Database

MongoDB Atlas will be used as the primary database.

The database will store information such as:

Users
Roles
Permissions
Products
Variants
Categories
Carts
Wishlists
Orders
Payments
Reviews
Coupons
Inventory
Shipments
Support tickets
Notifications
Audit logs
Suppliers
AI-related data

The detailed data model is documented separately in 07-database-design.md.

9. Image Storage

Cloudinary will be used for product and other required image storage.

The application should store the required image references and metadata in the database rather than storing large image files directly inside MongoDB.

10. Payment Integration

Razorpay will be used as the primary payment provider for the initial India-focused version.

The backend will be responsible for important payment operations such as:

Creating payment requests.
Receiving payment results.
Verifying payment information.
Handling payment failures.
Recording payment information.
Supporting refund operations where required.

Payment verification must happen on the server.

11. AI Layer

The platform may use an AI service for features such as:

Customer assistance.
Product recommendations.
Product description assistance.
SEO assistance.
Knowledge-based question answering.

AI should not be the source of truth for dynamic business information.

For information such as:

Price
Stock
Order Status
Payment Status
Product Availability

the application should retrieve authoritative data from the relevant application systems.

12. Vector Search

MongoDB Atlas Vector Search may be used to support knowledge-based AI features.

The system can use vector search to find relevant information from approved knowledge sources before sending context to the AI model.

A simplified flow is:

Customer Question
       ↓
Search Relevant Knowledge
       ↓
Vector Search
       ↓
Retrieve Relevant Information
       ↓
AI Model
       ↓
Response

The exact implementation will be defined during AI development.

13. Security

The platform will include appropriate security controls such as:

Secure authentication.
Password hashing.
HttpOnly cookies where appropriate.
JWT-based authentication where required.
RBAC.
Input validation.
Helmet.
CORS configuration.
Rate limiting.
Secure payment verification.
Audit logging.
Environment variables for secrets.

Security rules will be documented in more detail later.

14. Error Handling

The backend will use centralised error handling where possible.

API errors should have a consistent structure so that the frontend can handle them predictably.

Expected failures should be handled without exposing sensitive internal information.

15. Performance

The application should use appropriate performance techniques such as:

Pagination.
Database indexes.
API caching where useful.
TanStack Query caching.
Lazy loading.
Code splitting.
Image optimisation.
Debounced search.
Efficient database queries.

Performance optimisation should be based on actual application needs rather than unnecessary complexity.

16. External Services

The initial system may connect to external services such as:

MongoDB Atlas
Cloudinary
Razorpay
AI Provider

Each external integration should have:

Clear configuration.
Error handling.
Secure credentials.
Appropriate logging.
Failure handling.
17. Deployment Overview

The application will eventually contain:

Frontend
   ↓
Frontend Hosting

Backend
   ↓
Backend Hosting

Database
   ↓
MongoDB Atlas

Images
   ↓
Cloudinary

Payments
   ↓
Razorpay

AI
   ↓
AI Provider

The exact deployment providers and configuration will be documented during the deployment phase.

18. Architecture Principle

The main architecture principles are:

Keep the system modular.
Keep business logic separated from routes and controllers.
Keep security enforcement on the backend.
Avoid unnecessary infrastructure.
Make important business operations traceable.
Keep external integrations isolated.
Design for future growth without over-engineering the first version.

The initial goal is a clean and maintainable application that can evolve with real business requirements.