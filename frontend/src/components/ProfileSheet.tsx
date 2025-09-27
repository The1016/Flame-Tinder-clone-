// =============================================
// components/ProfilePage.tsx
// Revamped profile page with left-side circular hero photo
// and read-only Name field (grayed background)
// =============================================
"use client";


import { useState } from "react";
import Image from "next/image";
import { Camera, Upload } from "lucide-react";


// If you use shadcn/ui, you can swap these with their components
function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
return (
<label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-300 mb-1">
{children}
</label>
);
}


function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
const { className = "", ...rest } = props;
return (
<input
{...rest}
className={`w-full rounded-xl border border-neutral-700 bg-neutral-800/70 px-3 py-2 text-neutral-100 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-500 ${className}`}
/>
);
}


export type UserProfile = {
id: string;
name: string;
photoUrl?: string | null;
bio?: string | null;
interests?: string[];
};


export default function ProfilePage({ user }: { user: UserProfile }) {
const [photo, setPhoto] = useState<string | null>(user.photoUrl ?? null);


// Dummy upload handler — replace with your real uploader
const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;
const url = URL.createObjectURL(file);
setPhoto(url);
// TODO: upload to your storage and save to DB
};


return (
<div className="mx-auto max-w-5xl p-4 md:p-8">
<div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-6 md:gap-10">
{/* LEFT: Hero profile picture */}
<aside className="flex md:block items-center justify-center">
<div className="relative w-56 h-56 md:w-64 md:h-64">
<div className="absolute inset-0 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900" />
<div className="relative w-full h-full rounded-full overflow-hidden ring-4 ring-neutral-800 shadow-xl">
{photo ? (
<Image src={photo} alt="Profile" fill priority sizes="256px" className="object-cover" />
) : (
<div className="flex h-full w-full items-center justify-center text-neutral-400">
<Camera className="w-8 h-8" />
</div>
)}
</div>
<label
htmlFor="hero-upload"
className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-sm text-neutral-100 border border-white/10 cursor-pointer hover:bg-white/15"
>
<Upload className="w-4 h-4" /> Upload
</label>
<input id="hero-upload" type="file" accept="image/*" className="hidden" onChange={onPickFile} />
</div>
</aside>


{/* RIGHT: Profile fields */}
<section className="space-y-5">
<div>
<Label htmlFor="name">Name</Label>
{/* Read-only + grayed background to indicate it cannot be changed */}
<Input
id="name"
value={user.name}
readOnly
className="bg-neutral-900/70 text-neutral-300 border-neutral-800 cursor-not-allowed"
/>
<p className="mt-1 text-xs text-neutral-400">Name is managed by the system and cannot be edited.</p>
</div>


<div>
