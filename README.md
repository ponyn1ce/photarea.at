# ✨📚 Photarea.at - Creating photo albums 📚✨

Hello everyone. This is my first real order that I've been asked to make. The essence of the task is very simple, although it was not easy for me. It was necessary to completely raise the site from scratch, put it on the server (because it used a backend). In other words, this is a full-fledged **fullstack** development.
This repository contains all the project files, including backend and frontend development. Below you can find the structure of the project, the description of the pages, the libraries that have currently
been added to this project, as well as the development history and future plans of this project.

---

## What is on the site 🌐
- Main page (`index.html`) - the main page that the user gets to when visiting the site
- Profile page (`profile.html`) - The user's page. On this page, the user can change the name, view their cartons with the ability to change the products in it, as well as add some products to favorites. If the user has access to the site administration, then he has the opportunity to access the admin panel from this page and manage the site from it.
- FAQ page (`faq.html`) - the questions and answers page. This page contains the most popular questions that may be of interest to the user.
- Product page (`product.html`) - A product page where users can view the assortment of products. Administrators have the opportunity to add new products, as well as change the name and price of existing products.
- Contact page (`contact.html`) - The working title of this page is the chat page. In fact, in the future, this page will only exist to connect the customer with the technical support of the site, but at this stage of development, this page is the key to placing an order. The user needs to go to this page in order to place an order for a photo album because the site does not have integrated editors due to the fact that it is not finished and does not work correctly. The site uses messaging tools via the API. The messages are sent to the administrators, and if the administrator sends a reply message or any other message to the chat to the client, then this message is sent not only to the sender's chat, but is also duplicated in the mail so that the client does not miss the message.
- Support chat page (``)
- Login page (`login.html`) - The account login page. It is necessary for clients to be able to log in to their account. All accounts, including user information, are encrypted and stored in a separate database.
- Sign Up page (`registration.html`) - It is necessary for new users to register on the site.
- The Site Rules page (`user_agreement.html`) - User Agreement on consent and processing of personal data, as well as AGB
- admin chat (`admin-chat.html`) - It serves as a key element for connecting site administrators and clients. The messages that ordinary users send to the chat arrive on this page using the API. I described the full functionality above. On this page, administrators can also create a new website and select a specific user. In addition, the administrator can view the contact information of this user on the same page in order to verify the correctness of the data.
- admin panel (`admin-panel.html`) - A page for editing a product and adding an assortment to the product page. I described the functionality of the last page above. On this page, you can add photos, change the order of photos in the photo card, the name of products, add and remove discounts (in the future, it is planned to create the possibility of adding seasonal discounts as well). The administrator can also add new photos from his device.
- album guide (`album-guide.html`)
- forgot password reset page (`forgot_password_reset.html`)
- forgot password verify code page (`forgot_password_verify_code.html`)
- menu page (`menu.html`)
- support page (`support.html`)
- verify page (`verify.html`)
- orders page (`orders.html`)
- json files (`rus.json, eng.json, deu.json`)
- js files (`admin-chat.js, album-guide.js, auth.js, cookie-consent.js, faq.js, lang.js, login-form.js, orders.js, password-toggle.js, role-guard.js, support.js, testman.js, `)
---

## ✏️🖼️ What the editor can do (briefly) 🖼️✏️

- Rendering of pages and spreads, taking into account the cover and content.
- Adding images (via file input and IndexedDB), scaling, moving and applying templates (center, full, half, third, quarter, collage).
- Adding and editing text (iText), changing the text color.
- Support for "spreads" - navigation through reversals, adding/removing reversals.
- The ability to save individual spreads in IndexedDB and metadata in localStorage.
- Export the current spread or the entire project to PDF (jsPDF+ svg2pdf.js ). (it doesn't work. At this point, my code stopped working correctly, so I abandoned this idea in order to start refactoring and fix this error with renewed vigor in the future, but unfortunately or fortunately I did not have to do this, and instead it was decided with the customer to simply redo this entire editor and take based on the Canva engine.)
- Local image storage in IndexedDB (keys, blob storage).
- Restricted editing of certain pages (for example, special blocked areas), visual cues, and overlays.
- Thumbnail panel (thumbnails) for navigation and easy dragging of spreads (partially implemented).
- Utilities: cleaning, layer removal, history (undo stack), auto-save and dev-button to delete all saves.

---

## 🧰 Technologies and libraries 🧰

- React — the editor's interface (`editor-react/src').
- fabric.js — working with canvas, objects, clipping, exporting and interacting with canvas.
- jsPDF — export to PDF.
- svg2pdf.js — conversion of SVG text to PDF (for vector text to PDF).
- sql.js — storing exports (PDF) in a local WebAssembly-DB (optional).
- IndexedDB (via the standard API) — storing images and spread data.
- Simple utilities: `lang.js `(translation of the page content into other languages), `faq.js`, `darklightbutton.js `(theme switching+syncing theme with device theme).

---

## Demo behavior notes

- Frontend access checks are disabled (no forced login redirects).
- Admin product edit, delete, and image management are placeholders.
- In demo mode, product changes are kept in memory only and are not sent to any server.

---

# Test Account - Demo Functionality

## Overview

The site implements automatic initialization of the test account. This allows visitors to view the entire functionality of the site, including administrative functions, without having to register.

## How it works

### On the first visit

1. Når user visits the site for the first time (there is no authorization token)
2. The script `test-account.js ` automatically creates a test account
3. The user gets full access to the admin functions
4. No additional authentication is required.

### Test account credentials

- **User Name:** `testuser`
- **Email:** `test@photarea.at `
- **Role:** `777' (administrator)
- **Access level:** `2` (maximum)
- **Access:** All functions, including the admin panel

## Functionality

### Enabled for the test user:

, Profile view
, Creating projects
, Access to the admin panel
, Product management
, Chat with clients
, Viewing orders
, All other site functions

## Actions with the test account

### Check if the current user is a test user

```javascript
if (window.TEST_ACCOUNT.isTestAccount()) {
  console.log('This is a test account');
}
``

### Log out of the test account

```javascript
window.TEST_ACCOUNT.logout();
```

After logging out, the page will be reloaded and a new test account will be created.

## Switching to a real account

If a visitor wants to log in with a real account:

1. He can click on "Register" or "Sign in"
2. After successful authentication, the test account will be replaced with a real one.
3. The `auth_is_test = '0' flag will be set in localStorage
4. All the data of the real user will be uploaded

## Storage structure

The test account is stored in `localStorage`:

```javascript
{
  'token': 'test-token-demo-xxxxx',
  'auth_user': '{"id":"test-user-999","username":"testuser",...}',
  'auth_persist': '1',
  'auth_is_test': '1'
}
```

- `token' — a token for authorization (for local use)
- `auth_user' — user data in JSON format
- `auth_persist` — save flag when the browser is restarted
- `auth_is_test' — flag indicating the test account (`1' = test account, `0` = real account)

## Technical implementation

### Files involved in the implementation:

1. **`js/test-account.js `** is the main script for initializing the test account
2. **`js/role-guard.js `** — role-based access control
3. **`js/login-form.js `** — processing the input of a real user
4. **All HTML files** — connect the test-account script.js

### How scripts interact:

`` Page
loading ,

test-account.js initializes the test account
↓
role-guard.js checks access rights (uses a test one if there is no real one)

The user can view
the functionality
When logging in: login-form.js replaces the test account with a real one
``

## Notes for developers

### On the client side

- The test account works entirely on the basis of localStorage
- Does not require connection to the backend to work
- Can be used for local testing

### On the server side

- When sending a request with `test-token-demo-xxxxx`, the server needs to recognize it as a test token.
- Either ignore it and let the client side work independently
- It is recommended to add the processing of test tokens on the backend for the pilot project

## Disabling the test account (for production)

To disable the automatic test account:

1. Delete/comment on the connection `<script src="./js/test-account.js"></script>` from HTML
2. Or change the logic in `test-account.js `

## FAQ

**Q: Can a user lose data when switching to a real account?**
A: No. The test account is stored separately. When you log in, it is completely replaced by the real one.

**Q: What happens when JavaScript is disabled?**
A: No test account will be created without JavaScript. The user will be redirected to the login page.

**Q: Does the test account work on different browser tabs?**
A: Yes, because localStorage is common to all tabs in the same domain.

**Q: Is it possible to be in a test account on one tab and in a real account on another at the same time?**
A: No, localStorage is shared. The last login dictates the authorization status.

---

## Some introductory information on the order and functionality ℹ️

It was necessary to create a website, the design of which was not initially defined, but it appeared at the development stage and I needed to completely adapt the entire site to this design, which I successfully did. After I wrote the main page, I needed to create several other pages that could give more information to the user about the product that the customer plans to make. 

They were photo albums. The customer planned to sell photo albums in Austria, so I needed to adapt the site not only to international standards, but also to successfully adapt it to Austrian ones. 

The customer also asked to translate the website into several languages: Russian, Ukrainian, English, German. In theory, translation happens automatically, but for some reason it seems to me that this function does not always work correctly, so an additional language switch has been introduced into the interface so that the user can choose the language that suits him best. 

The product page was the most difficult because I needed to implement a specific request. This request looked like almost the same thing that was done on marketplaces in the CIS countries, so I had the opportunity to see personally what the customer wanted and I think I did an excellent job with this task. 

Also, at the first stage, the customer asked me to implement a tech chat.to make it possible to discuss the order with the customer and do what he wants. The entire chat, as well as the entire database, is based on SQLite. The backend itself is written in Nodejs. It's the same with the admin panel. Registration works, which sends an email to the user's email address. There is a user check for the correctness of the data. There is a client-admin profile with the ability to change data, view carzines, and more.

---

The project is still under development. In the future, I plan to introduce a photo album editor, with which the user can assemble the album of his dreams. The editor will be implemented on React and use several libraries at once. After the user creates their album, it will be saved as a PDF format and stored in a database - assigned to the user. Next, this PDF format will go to the printing house, where creative ideas will be transferred to paper.

---

## My thoughts 💬

I will gladly take on any idea that the customer suggests to me. I treat every client with trepidation and make a regular report. I was happy to work with such a customer.
