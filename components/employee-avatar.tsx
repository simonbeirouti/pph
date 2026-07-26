import Image from "next/image"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function employeeInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function EmployeeAvatar({
  className,
  name,
  url,
}: {
  className?: string
  name: string
  url: string | null
}) {
  return (
    <Avatar className={className}>
      {url ? (
        <Image
          alt={`${name} profile photo`}
          className="aspect-square size-full rounded-full object-cover"
          height={40}
          src={url}
          unoptimized
          width={40}
        />
      ) : (
        <AvatarFallback>{employeeInitials(name)}</AvatarFallback>
      )}
    </Avatar>
  )
}
