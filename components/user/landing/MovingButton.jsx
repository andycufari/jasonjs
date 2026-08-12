import React from "react";
import Link from "next/link";
import Button from "@/components/user/ui/moving-button";

export default function MovingButton({props}) {
  const { label, href } = props;

  return (
    (<div>
      <Button
        borderRadius="1.75rem"
        >
        <Link href={href}>
          {label}
        </Link>
      </Button>
    </div>)
  );
}
