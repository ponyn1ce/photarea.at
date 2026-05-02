document.addEventListener("DOMContentLoaded", () => {
    // Check if profile exists
    const profile = document.querySelector(".profile");
    if (!profile) return;

    // Make the profile container relative to position the dropdown
    profile.style.position = "relative";
    profile.style.cursor = "pointer";

    // Obtain user info (fallback to placeholders if not found)
    const profilePhotoSrc = document.querySelector(".profile-photo img")?.src || "/img/default-avatar.png";
    const userName = document.querySelector(".profile .info b")?.textContent || "User";
    const userRole = document.querySelector(".profile .info small")?.textContent || "Role";

    // Create the dropdown menu
    const dropdown = document.createElement("div");
    dropdown.className = "profile-dropdown";

    dropdown.innerHTML = `
        <div class="profile-dropdown-header">
            <img src="${profilePhotoSrc}" alt="Profile">
            <div class="info">
                <h4>${userName}</h4>
                <p>${userRole}</p>
            </div>
        </div>
        
        <a href="https://github.com/ponyn1ce" class="profile-dropdown-item">
            <span class="material-icons-sharp">person</span>
            <p>Profile</p>
        </a>
        <a href="#" class="profile-dropdown-item">
            <span class="material-icons-sharp">manage_accounts</span>
            <p>Home</p>
        </a>
        <a href="https://t.me/photareabot" class="profile-dropdown-item">
            <span class="material-icons-sharp">settings</span>
            <p>Telegram Bot</p>
        </a>
        
        <div class="profile-dropdown-divider"></div>
        
    `;

    profile.appendChild(dropdown);

    // Toggle dropdown on click
    profile.addEventListener("click", (e) => {
        // Prevent click when clicking strictly inside dropdown items if needed, 
        // but simple toggle is okay for now on the whole container
        dropdown.classList.toggle("active");
        e.stopPropagation();
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!profile.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });

    // Prevent closing when clicking inside the dropdown itself
    dropdown.addEventListener("click", (e) => {
        e.stopPropagation();
    });
});
