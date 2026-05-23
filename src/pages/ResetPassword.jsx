import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  return (
    <AuthLayout
      icon={Mail}
      title="Check your email"
      subtitle="A password reset link has been sent"
    >
      <p className="text-sm text-foreground text-center">
        Check your email for a password reset link. Click it to set a new password.
      </p>
      <div className="mt-6">
        <Link to="/login">
          <Button variant="outline" className="w-full h-12">
            Back to Login
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}

