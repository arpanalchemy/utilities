export class WhatsappBody {
  userID: number;
  variables?: any;
}
export type WhatsappRequestBody = {
  category: string;
  subCategory: string;
  userID: number;
  variables?: any;
};

export class WhatsappRequestDto {
  category: string;
  subCategory: string;
  messages: WhatsappBody[];
}
