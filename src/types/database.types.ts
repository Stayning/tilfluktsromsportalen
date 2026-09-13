export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avvik: {
        Row: {
          beskrivelse: string
          checklist_item_id: string
          emne: string
          id: string
          komponent_id: string | null
          photo_ids: string[] | null
          updated_at: string | null
          vurdering_id: string
        }
        Insert: {
          beskrivelse: string
          checklist_item_id: string
          emne: string
          id: string
          komponent_id?: string | null
          photo_ids?: string[] | null
          updated_at?: string | null
          vurdering_id: string
        }
        Update: {
          beskrivelse?: string
          checklist_item_id?: string
          emne?: string
          id?: string
          komponent_id?: string | null
          photo_ids?: string[] | null
          updated_at?: string | null
          vurdering_id?: string
        }
        Relationships: []
      }
      hurtigvalg_produkt: {
        Row: {
          created_at: string
          hurtigvalg_id: string
          id: string
          produkt_id: number
        }
        Insert: {
          created_at?: string
          hurtigvalg_id: string
          id?: string
          produkt_id: number
        }
        Update: {
          created_at?: string
          hurtigvalg_id?: string
          id?: string
          produkt_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "hurtigvalg_produkt_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkt"
            referencedColumns: ["id"]
          },
        ]
      }
      komponent: {
        Row: {
          antall: number | null
          beskrivelse: string | null
          bilde_url: string | null
          created_at: string
          id: string
          pakning: string | null
          plassering: string | null
          tilfluktsrom_id: string
          type: string
        }
        Insert: {
          antall?: number | null
          beskrivelse?: string | null
          bilde_url?: string | null
          created_at?: string
          id?: string
          pakning?: string | null
          plassering?: string | null
          tilfluktsrom_id: string
          type: string
        }
        Update: {
          antall?: number | null
          beskrivelse?: string | null
          bilde_url?: string | null
          created_at?: string
          id?: string
          pakning?: string | null
          plassering?: string | null
          tilfluktsrom_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "komponent_tilfluktsrom_id_fkey"
            columns: ["tilfluktsrom_id"]
            isOneToOne: false
            referencedRelation: "tilfluktsrom"
            referencedColumns: ["id"]
          },
        ]
      }
      kontaktperson_kunde: {
        Row: {
          created_at: string
          id: string
          kontaktperson_id: string | null
          kunde_id: number | null
          rolle: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kontaktperson_id?: string | null
          kunde_id?: number | null
          rolle?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kontaktperson_id?: string | null
          kunde_id?: number | null
          rolle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kontaktperson_kunde_kontaktperson_id_fkey"
            columns: ["kontaktperson_id"]
            isOneToOne: false
            referencedRelation: "kontaktpersoner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kontaktperson_kunde_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "kunde"
            referencedColumns: ["id"]
          },
        ]
      }
      kontaktperson_tilfluktsrom: {
        Row: {
          created_at: string
          id: string
          kontaktperson_id: string | null
          rolle: string | null
          tilfluktsrom_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kontaktperson_id?: string | null
          rolle?: string | null
          tilfluktsrom_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kontaktperson_id?: string | null
          rolle?: string | null
          tilfluktsrom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kontaktperson_tilfluktsrom_kontaktperson_id_fkey"
            columns: ["kontaktperson_id"]
            isOneToOne: false
            referencedRelation: "kontaktpersoner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kontaktperson_tilfluktsrom_tilfluktsrom_id_fkey"
            columns: ["tilfluktsrom_id"]
            isOneToOne: false
            referencedRelation: "tilfluktsrom"
            referencedColumns: ["id"]
          },
        ]
      }
      kontaktpersoner: {
        Row: {
          aktiv: boolean | null
          created_at: string
          epost: string | null
          id: string
          navn: string
          telefon: string | null
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string
          epost?: string | null
          id?: string
          navn: string
          telefon?: string | null
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string
          epost?: string | null
          id?: string
          navn?: string
          telefon?: string | null
        }
        Relationships: []
      }
      kunde: {
        Row: {
          aktiv: boolean | null
          created_at: string
          id: number
          navn: string
          nummer: number | null
          orgnr: string | null
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string
          id: number
          navn: string
          nummer?: number | null
          orgnr?: string | null
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string
          id?: number
          navn?: string
          nummer?: number | null
          orgnr?: string | null
        }
        Relationships: []
      }
      notater: {
        Row: {
          checklist_item_id: string
          id: string
          komponent_id: string | null
          notat: string
          photo_ids: string[] | null
          updated_at: string | null
          vurdering_id: string
        }
        Insert: {
          checklist_item_id: string
          id: string
          komponent_id?: string | null
          notat: string
          photo_ids?: string[] | null
          updated_at?: string | null
          vurdering_id: string
        }
        Update: {
          checklist_item_id?: string
          id?: string
          komponent_id?: string | null
          notat?: string
          photo_ids?: string[] | null
          updated_at?: string | null
          vurdering_id?: string
        }
        Relationships: []
      }
      observasjoner: {
        Row: {
          beskrivelse: string
          checklist_item_id: string
          emne: string
          id: string
          komponent_id: string | null
          photo_ids: string[] | null
          updated_at: string | null
          vurdering_id: string
        }
        Insert: {
          beskrivelse: string
          checklist_item_id: string
          emne: string
          id: string
          komponent_id?: string | null
          photo_ids?: string[] | null
          updated_at?: string | null
          vurdering_id: string
        }
        Update: {
          beskrivelse?: string
          checklist_item_id?: string
          emne?: string
          id?: string
          komponent_id?: string | null
          photo_ids?: string[] | null
          updated_at?: string | null
          vurdering_id?: string
        }
        Relationships: []
      }
      produkt: {
        Row: {
          aktiv: boolean | null
          created_at: string
          enhet: string | null
          id: number
          navn: string | null
          nummer: number | null
          pris_eks_mva: number | null
          versjon: number | null
          visning: string | null
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string
          enhet?: string | null
          id: number
          navn?: string | null
          nummer?: number | null
          pris_eks_mva?: number | null
          versjon?: number | null
          visning?: string | null
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string
          enhet?: string | null
          id?: number
          navn?: string | null
          nummer?: number | null
          pris_eks_mva?: number | null
          versjon?: number | null
          visning?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
          tos_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          tos_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          tos_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tilbud: {
        Row: {
          beskrivelse: string | null
          created_at: string
          id: string
          vurdering_id: string
        }
        Insert: {
          beskrivelse?: string | null
          created_at?: string
          id?: string
          vurdering_id: string
        }
        Update: {
          beskrivelse?: string | null
          created_at?: string
          id?: string
          vurdering_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tilbud_vurdering_id_fkey"
            columns: ["vurdering_id"]
            isOneToOne: true
            referencedRelation: "vurdering"
            referencedColumns: ["id"]
          },
        ]
      }
      tilbud_produkter: {
        Row: {
          antall: number
          created_at: string
          id: string
          produkt_id: number
          tilbud_id: string
        }
        Insert: {
          antall?: number
          created_at?: string
          id?: string
          produkt_id: number
          tilbud_id: string
        }
        Update: {
          antall?: number
          created_at?: string
          id?: string
          produkt_id?: number
          tilbud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tilbud_produkter_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilbud_produkter_tilbud_id_fkey"
            columns: ["tilbud_id"]
            isOneToOne: false
            referencedRelation: "tilbud"
            referencedColumns: ["id"]
          },
        ]
      }
      tilfluktsrom: {
        Row: {
          adresse: Json | null
          alias: string | null
          bruksareal: number | null
          byggeaar: number | null
          created_at: string
          created_by: string | null
          forskrift: string | null
          fredsbruk: string | null
          har_aggregat: string | null
          id: string
          konstruksjon: string | null
          kundenavn: string | null
          kundenummer: number | null
          matrikkel: string | null
          plasser: number | null
          sluse_type: string | null
          tegninger: string | null
          type: string | null
          updated_at: string
          urinal: string | null
          vannklosett: string | null
        }
        Insert: {
          adresse?: Json | null
          alias?: string | null
          bruksareal?: number | null
          byggeaar?: number | null
          created_at?: string
          created_by?: string | null
          forskrift?: string | null
          fredsbruk?: string | null
          har_aggregat?: string | null
          id: string
          konstruksjon?: string | null
          kundenavn?: string | null
          kundenummer?: number | null
          matrikkel?: string | null
          plasser?: number | null
          sluse_type?: string | null
          tegninger?: string | null
          type?: string | null
          updated_at?: string
          urinal?: string | null
          vannklosett?: string | null
        }
        Update: {
          adresse?: Json | null
          alias?: string | null
          bruksareal?: number | null
          byggeaar?: number | null
          created_at?: string
          created_by?: string | null
          forskrift?: string | null
          fredsbruk?: string | null
          har_aggregat?: string | null
          id?: string
          konstruksjon?: string | null
          kundenavn?: string | null
          kundenummer?: number | null
          matrikkel?: string | null
          plasser?: number | null
          sluse_type?: string | null
          tegninger?: string | null
          type?: string | null
          updated_at?: string
          urinal?: string | null
          vannklosett?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tilfluktsrom_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilfluktsrom_kundenavn_fkey"
            columns: ["kundenavn"]
            isOneToOne: false
            referencedRelation: "kunde"
            referencedColumns: ["navn"]
          },
          {
            foreignKeyName: "tilfluktsrom_kundenummer_fkey"
            columns: ["kundenummer"]
            isOneToOne: false
            referencedRelation: "kunde"
            referencedColumns: ["nummer"]
          },
        ]
      }
      tilfluktsrom_documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          tilfluktsrom_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          tilfluktsrom_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          tilfluktsrom_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tilfluktsrom_documents_tilfluktsrom_id_fkey"
            columns: ["tilfluktsrom_id"]
            isOneToOne: false
            referencedRelation: "tilfluktsrom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilfluktsrom_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tilfluktsrom_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          phone_number: string
          shelter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          phone_number: string
          shelter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          phone_number?: string
          shelter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tilfluktsrom_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilfluktsrom_invites_shelter_id_fkey"
            columns: ["shelter_id"]
            isOneToOne: false
            referencedRelation: "tilfluktsrom"
            referencedColumns: ["id"]
          },
        ]
      }
      tilfluktsrom_members: {
        Row: {
          added_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          shelter_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          shelter_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          shelter_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tilfluktsrom_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilfluktsrom_members_shelter_id_fkey"
            columns: ["shelter_id"]
            isOneToOne: false
            referencedRelation: "tilfluktsrom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilfluktsrom_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tilstand: {
        Row: {
          checklist_item_id: string
          id: string
          status: string[]
          updated_at: string | null
          vurdering_id: string
        }
        Insert: {
          checklist_item_id: string
          id: string
          status: string[]
          updated_at?: string | null
          vurdering_id: string
        }
        Update: {
          checklist_item_id?: string
          id?: string
          status?: string[]
          updated_at?: string | null
          vurdering_id?: string
        }
        Relationships: []
      }
      vurdering: {
        Row: {
          created_at: string
          godkjent: boolean | null
          id: string
          kontaktperson_id: string | null
          kontrolldato: string | null
          skjema: string | null
          status: string | null
          tilfluktsrom: string | null
          tilstandsvurdering: string | null
          utførende: string | null
          utstyr_registrering: Json | null
          vurderingsnummer: number | null
        }
        Insert: {
          created_at?: string
          godkjent?: boolean | null
          id: string
          kontaktperson_id?: string | null
          kontrolldato?: string | null
          skjema?: string | null
          status?: string | null
          tilfluktsrom?: string | null
          tilstandsvurdering?: string | null
          utførende?: string | null
          utstyr_registrering?: Json | null
          vurderingsnummer?: number | null
        }
        Update: {
          created_at?: string
          godkjent?: boolean | null
          id?: string
          kontaktperson_id?: string | null
          kontrolldato?: string | null
          skjema?: string | null
          status?: string | null
          tilfluktsrom?: string | null
          tilstandsvurdering?: string | null
          utførende?: string | null
          utstyr_registrering?: Json | null
          vurderingsnummer?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vurdering_kontaktperson_id_fkey"
            columns: ["kontaktperson_id"]
            isOneToOne: false
            referencedRelation: "kontaktpersoner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vurdering_tilfluktsrom_fkey"
            columns: ["tilfluktsrom"]
            isOneToOne: false
            referencedRelation: "tilfluktsrom"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_forskrift_innhold: {
        Args: { forskrift_year: string; punkt_refs: string[] }
        Returns: {
          innhold: string
          punkt: string
        }[]
      }
      get_sjekkliste: {
        Args: { forskrift_year: string }
        Returns: {
          forskrift_refs: string[]
          group_id: number
          group_title: string
          item_id: string
          item_title: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: { shelter_id: string }; Returns: boolean }
      shares_shelter_with: { Args: { other_user_id: string }; Returns: boolean }
    }
    Enums: {
      document_type:
        | "drifts_og_klargjoringsinstruks"
        | "betjeningsinstruks_ventilasjon"
        | "annet"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      document_type: [
        "drifts_og_klargjoringsinstruks",
        "betjeningsinstruks_ventilasjon",
        "annet",
      ],
    },
  },
} as const

// Convenience type aliases
export type Shelter = Database['public']['Tables']['tilfluktsrom']['Row']
export type ShelterInsert = Database['public']['Tables']['tilfluktsrom']['Insert']
export type ShelterUpdate = Database['public']['Tables']['tilfluktsrom']['Update']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Vurdering = Database['public']['Tables']['vurdering']['Row']
export type VurderingInsert = Database['public']['Tables']['vurdering']['Insert']
export type VurderingUpdate = Database['public']['Tables']['vurdering']['Update']
export type Avvik = Database['public']['Tables']['avvik']['Row']
export type AvvikInsert = Database['public']['Tables']['avvik']['Insert']
export type AvvikUpdate = Database['public']['Tables']['avvik']['Update']
export type Kunde = Database['public']['Tables']['kunde']['Row']
export type KundeInsert = Database['public']['Tables']['kunde']['Insert']
export type KundeUpdate = Database['public']['Tables']['kunde']['Update']
export type Kontaktperson = Database['public']['Tables']['kontaktpersoner']['Row']
export type Komponent = Database['public']['Tables']['komponent']['Row']
export type Notater = Database['public']['Tables']['notater']['Row']
export type Observasjon = Database['public']['Tables']['observasjoner']['Row']
export type Tilstand = Database['public']['Tables']['tilstand']['Row']

// Helper types for JSON fields
export interface ShelterAdresse {
  gate?: string
  postnr?: string
  sted?: string
  kommune?: string
}

export interface KundeAdresse {
  gate?: string
  sted?: string
  postnummer?: string
  land?: string
}
