export class RegisterResponseDto {
  success: boolean;
  message: string;
  userEvent?: {
    id: string;
    status: string;
    payment_status: string;
    created_at: string;
  };
}
