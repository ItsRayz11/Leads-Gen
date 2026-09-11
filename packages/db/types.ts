export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'needs_verification'
  | 'unverified';
export type Freshness = 'fresh' | 'recent' | 'aging' | 'stale' | 'unknown';
export type SignalStrength = 'weak' | 'moderate' | 'strong';
export type LeadVertical = 'hiring' | 'general' | 'card_affiliate' | 'live_search';
export type LeadTier = 'A+' | 'A' | 'B' | 'C' | 'Low Priority';
export type LeadStatus =
  | 'new'
  | 'researching'
  | 'qualified'
  | 'contacted'
  | 'follow_up'
  | 'replied'
  | 'meeting'
  | 'negotiation'
  | 'won'
  | 'no_response'
  | 'rejected'
  | 'not_interested'
  | 'not_a_fit'
  | 'lost'
  | 'on_hold';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type SourceType = 'free' | 'paid';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type OutreachStatus = 'draft' | 'sent' | 'replied' | 'no_response' | 'bounced';
export type OutreachDirection = 'outbound' | 'inbound';
export type ProviderCategory = 'lead_data' | 'ai';
export type TargetCompanySource = 'greenhouse' | 'lever' | 'ashby' | 'agency';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          website: string | null;
          domain: string | null;
          description: string | null;
          industry: string | null;
          category: string | null;
          country: string | null;
          region: string | null;
          city: string | null;
          company_size: string | null;
          founded_year: number | null;
          funding: string | null;
          social_profiles: Json;
          github_url: string | null;
          other_profiles: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          website?: string | null;
          domain?: string | null;
          description?: string | null;
          industry?: string | null;
          category?: string | null;
          country?: string | null;
          region?: string | null;
          city?: string | null;
          company_size?: string | null;
          founded_year?: number | null;
          funding?: string | null;
          social_profiles?: Json;
          github_url?: string | null;
          other_profiles?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          legal_name?: string | null;
          website?: string | null;
          domain?: string | null;
          description?: string | null;
          industry?: string | null;
          category?: string | null;
          country?: string | null;
          region?: string | null;
          city?: string | null;
          company_size?: string | null;
          founded_year?: number | null;
          funding?: string | null;
          social_profiles?: Json;
          github_url?: string | null;
          other_profiles?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_sources: {
        Row: {
          id: string;
          company_id: string;
          source_name: string;
          source_url: string | null;
          first_seen_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          source_name: string;
          source_url?: string | null;
          first_seen_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          source_name?: string;
          source_url?: string | null;
          first_seen_at?: string;
        };
        Relationships: [{ foreignKeyName: 'company_sources_company_id_fkey'; columns: ['company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }];
      };
      contacts: {
        Row: {
          id: string;
          company_id: string | null;
          name: string | null;
          first_name: string | null;
          last_name: string | null;
          job_title: string | null;
          department: string | null;
          profile_url: string | null;
          email: string | null;
          contact_method: string | null;
          contact_value: string | null;
          source: string | null;
          verification_status: VerificationStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          job_title?: string | null;
          department?: string | null;
          profile_url?: string | null;
          email?: string | null;
          contact_method?: string | null;
          contact_value?: string | null;
          source?: string | null;
          verification_status?: VerificationStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          job_title?: string | null;
          department?: string | null;
          profile_url?: string | null;
          email?: string | null;
          contact_method?: string | null;
          contact_value?: string | null;
          source?: string | null;
          verification_status?: VerificationStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'contacts_company_id_fkey'; columns: ['company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }];
      };
      leads: {
        Row: {
          id: string;
          company_id: string;
          primary_contact_id: string | null;
          vertical: LeadVertical;
          title: string;
          opportunity_type: string | null;
          service_type: string | null;
          score: number;
          tier: LeadTier | null;
          status: LeadStatus;
          priority: Priority | null;
          buying_signal_summary: string | null;
          signal_strength: SignalStrength | null;
          signal_date: string | null;
          freshness: Freshness | null;
          verification_status: VerificationStatus;
          recommended_offer: string | null;
          qualification_summary: string | null;
          owner: string | null;
          source_type: SourceType | null;
          vertical_data: Json;
          created_at: string;
          updated_at: string;
          last_contacted_at: string | null;
          next_follow_up_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          primary_contact_id?: string | null;
          vertical: LeadVertical;
          title: string;
          opportunity_type?: string | null;
          service_type?: string | null;
          score?: number;
          tier?: LeadTier | null;
          status?: LeadStatus;
          priority?: Priority | null;
          buying_signal_summary?: string | null;
          signal_strength?: SignalStrength | null;
          signal_date?: string | null;
          freshness?: Freshness | null;
          verification_status?: VerificationStatus;
          recommended_offer?: string | null;
          qualification_summary?: string | null;
          owner?: string | null;
          source_type?: SourceType | null;
          vertical_data?: Json;
          created_at?: string;
          updated_at?: string;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          primary_contact_id?: string | null;
          vertical?: LeadVertical;
          title?: string;
          opportunity_type?: string | null;
          service_type?: string | null;
          score?: number;
          tier?: LeadTier | null;
          status?: LeadStatus;
          priority?: Priority | null;
          buying_signal_summary?: string | null;
          signal_strength?: SignalStrength | null;
          signal_date?: string | null;
          freshness?: Freshness | null;
          verification_status?: VerificationStatus;
          recommended_offer?: string | null;
          qualification_summary?: string | null;
          owner?: string | null;
          source_type?: SourceType | null;
          vertical_data?: Json;
          created_at?: string;
          updated_at?: string;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
        };
        Relationships: [{ foreignKeyName: 'leads_company_id_fkey'; columns: ['company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }, { foreignKeyName: 'leads_primary_contact_id_fkey'; columns: ['primary_contact_id']; isOneToOne: false; referencedRelation: 'contacts'; referencedColumns: ['id'] }];
      };
      evidence: {
        Row: {
          id: string;
          lead_id: string;
          source: string;
          url: string | null;
          source_title: string | null;
          source_type: string | null;
          description: string;
          signal_supported: string | null;
          published_at: string | null;
          discovered_at: string;
          verified_at: string | null;
          freshness: Freshness | null;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          source: string;
          url?: string | null;
          source_title?: string | null;
          source_type?: string | null;
          description: string;
          signal_supported?: string | null;
          published_at?: string | null;
          discovered_at?: string;
          verified_at?: string | null;
          freshness?: Freshness | null;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          source?: string;
          url?: string | null;
          source_title?: string | null;
          source_type?: string | null;
          description?: string;
          signal_supported?: string | null;
          published_at?: string | null;
          discovered_at?: string;
          verified_at?: string | null;
          freshness?: Freshness | null;
          confidence?: number | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: 'evidence_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }];
      };
      lead_signals: {
        Row: {
          id: string;
          lead_id: string;
          signal_type: string;
          signal_strength: SignalStrength | null;
          signal_description: string;
          signal_date: string | null;
          source: string | null;
          evidence_id: string | null;
          confidence: number | null;
          verification_status: VerificationStatus;
          freshness: Freshness | null;
          is_primary: boolean;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          signal_type: string;
          signal_strength?: SignalStrength | null;
          signal_description: string;
          signal_date?: string | null;
          source?: string | null;
          evidence_id?: string | null;
          confidence?: number | null;
          verification_status?: VerificationStatus;
          freshness?: Freshness | null;
          is_primary?: boolean;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          signal_type?: string;
          signal_strength?: SignalStrength | null;
          signal_description?: string;
          signal_date?: string | null;
          source?: string | null;
          evidence_id?: string | null;
          confidence?: number | null;
          verification_status?: VerificationStatus;
          freshness?: Freshness | null;
          is_primary?: boolean;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: 'lead_signals_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'lead_signals_evidence_id_fkey'; columns: ['evidence_id']; isOneToOne: false; referencedRelation: 'evidence'; referencedColumns: ['id'] }];
      };
      lead_scores: {
        Row: {
          id: string;
          lead_id: string;
          intent_score: number | null;
          fit_score: number | null;
          evidence_score: number | null;
          freshness_score: number | null;
          contactability_score: number | null;
          company_quality_score: number | null;
          overall_score: number;
          tier: string | null;
          breakdown: Json;
          is_human_override: boolean;
          override_reason: string | null;
          tier_limited_by: string | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          intent_score?: number | null;
          fit_score?: number | null;
          evidence_score?: number | null;
          freshness_score?: number | null;
          contactability_score?: number | null;
          company_quality_score?: number | null;
          overall_score: number;
          tier?: string | null;
          breakdown?: Json;
          is_human_override?: boolean;
          override_reason?: string | null;
          tier_limited_by?: string | null;
          computed_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          intent_score?: number | null;
          fit_score?: number | null;
          evidence_score?: number | null;
          freshness_score?: number | null;
          contactability_score?: number | null;
          company_quality_score?: number | null;
          overall_score?: number;
          tier?: string | null;
          breakdown?: Json;
          is_human_override?: boolean;
          override_reason?: string | null;
          tier_limited_by?: string | null;
          computed_at?: string;
        };
        Relationships: [{ foreignKeyName: 'lead_scores_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }];
      };
      lead_status_history: {
        Row: {
          id: string;
          lead_id: string;
          old_status: string | null;
          new_status: string;
          reason: string | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          old_status?: string | null;
          new_status: string;
          reason?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          old_status?: string | null;
          new_status?: string;
          reason?: string | null;
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [{ foreignKeyName: 'lead_status_history_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'lead_status_history_changed_by_fkey'; columns: ['changed_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          color: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string | null;
        };
        Relationships: [];
      };
      lead_tags: {
        Row: {
          lead_id: string;
          tag_id: string;
        };
        Insert: {
          lead_id: string;
          tag_id: string;
        };
        Update: {
          lead_id?: string;
          tag_id?: string;
        };
        Relationships: [{ foreignKeyName: 'lead_tags_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'lead_tags_tag_id_fkey'; columns: ['tag_id']; isOneToOne: false; referencedRelation: 'tags'; referencedColumns: ['id'] }];
      };
      activities: {
        Row: {
          id: string;
          lead_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          type: string;
          description: string;
          metadata: Json;
          occurred_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          type: string;
          description: string;
          metadata?: Json;
          occurred_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          type?: string;
          description?: string;
          metadata?: Json;
          occurred_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: 'activities_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'activities_company_id_fkey'; columns: ['company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }, { foreignKeyName: 'activities_contact_id_fkey'; columns: ['contact_id']; isOneToOne: false; referencedRelation: 'contacts'; referencedColumns: ['id'] }, { foreignKeyName: 'activities_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
      };
      outreach: {
        Row: {
          id: string;
          lead_id: string;
          contact_id: string | null;
          channel: string;
          direction: OutreachDirection;
          message: string | null;
          recipient: string | null;
          result: string | null;
          status: OutreachStatus;
          sent_at: string | null;
          follow_up_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          contact_id?: string | null;
          channel: string;
          direction?: OutreachDirection;
          message?: string | null;
          recipient?: string | null;
          result?: string | null;
          status?: OutreachStatus;
          sent_at?: string | null;
          follow_up_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          contact_id?: string | null;
          channel?: string;
          direction?: OutreachDirection;
          message?: string | null;
          recipient?: string | null;
          result?: string | null;
          status?: OutreachStatus;
          sent_at?: string | null;
          follow_up_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'outreach_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'outreach_contact_id_fkey'; columns: ['contact_id']; isOneToOne: false; referencedRelation: 'contacts'; referencedColumns: ['id'] }];
      };
      tasks: {
        Row: {
          id: string;
          lead_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          outreach_id: string | null;
          title: string;
          due_date: string | null;
          priority: Priority;
          status: TaskStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          outreach_id?: string | null;
          title: string;
          due_date?: string | null;
          priority?: Priority;
          status?: TaskStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          outreach_id?: string | null;
          title?: string;
          due_date?: string | null;
          priority?: Priority;
          status?: TaskStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'tasks_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'tasks_company_id_fkey'; columns: ['company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }, { foreignKeyName: 'tasks_contact_id_fkey'; columns: ['contact_id']; isOneToOne: false; referencedRelation: 'contacts'; referencedColumns: ['id'] }, { foreignKeyName: 'tasks_outreach_id_fkey'; columns: ['outreach_id']; isOneToOne: false; referencedRelation: 'outreach'; referencedColumns: ['id'] }];
      };
      notes: {
        Row: {
          id: string;
          lead_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          body: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          body: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          body?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'notes_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }, { foreignKeyName: 'notes_company_id_fkey'; columns: ['company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }, { foreignKeyName: 'notes_contact_id_fkey'; columns: ['contact_id']; isOneToOne: false; referencedRelation: 'contacts'; referencedColumns: ['id'] }, { foreignKeyName: 'notes_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
      };
      search_configs: {
        Row: {
          id: string;
          vertical: LeadVertical;
          name: string;
          keywords: string[] | null;
          industries: string[] | null;
          geography: string[] | null;
          exclude_keywords: string[] | null;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vertical: LeadVertical;
          name: string;
          keywords?: string[] | null;
          industries?: string[] | null;
          geography?: string[] | null;
          exclude_keywords?: string[] | null;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vertical?: LeadVertical;
          name?: string;
          keywords?: string[] | null;
          industries?: string[] | null;
          geography?: string[] | null;
          exclude_keywords?: string[] | null;
          enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          id: string;
          name: string;
          query_text: string | null;
          filters: Json;
          vertical: string | null;
          created_at: string;
          last_run_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          query_text?: string | null;
          filters?: Json;
          vertical?: string | null;
          created_at?: string;
          last_run_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          query_text?: string | null;
          filters?: Json;
          vertical?: string | null;
          created_at?: string;
          last_run_at?: string | null;
        };
        Relationships: [];
      };
      search_history: {
        Row: {
          id: string;
          saved_search_id: string | null;
          query_text: string | null;
          filters: Json;
          results_count: number;
          qualified_count: number;
          saved_count: number;
          run_at: string;
        };
        Insert: {
          id?: string;
          saved_search_id?: string | null;
          query_text?: string | null;
          filters?: Json;
          results_count?: number;
          qualified_count?: number;
          saved_count?: number;
          run_at?: string;
        };
        Update: {
          id?: string;
          saved_search_id?: string | null;
          query_text?: string | null;
          filters?: Json;
          results_count?: number;
          qualified_count?: number;
          saved_count?: number;
          run_at?: string;
        };
        Relationships: [{ foreignKeyName: 'search_history_saved_search_id_fkey'; columns: ['saved_search_id']; isOneToOne: false; referencedRelation: 'saved_searches'; referencedColumns: ['id'] }];
      };
      search_results: {
        Row: {
          id: string;
          search_history_id: string;
          raw_lead: Json;
          matched_company_id: string | null;
          matched_lead_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          search_history_id: string;
          raw_lead: Json;
          matched_company_id?: string | null;
          matched_lead_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          search_history_id?: string;
          raw_lead?: Json;
          matched_company_id?: string | null;
          matched_lead_id?: string | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: 'search_results_search_history_id_fkey'; columns: ['search_history_id']; isOneToOne: false; referencedRelation: 'search_history'; referencedColumns: ['id'] }, { foreignKeyName: 'search_results_matched_company_id_fkey'; columns: ['matched_company_id']; isOneToOne: false; referencedRelation: 'companies'; referencedColumns: ['id'] }, { foreignKeyName: 'search_results_matched_lead_id_fkey'; columns: ['matched_lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }];
      };
      provider_connections: {
        Row: {
          id: string;
          provider_name: string;
          category: ProviderCategory;
          enabled: boolean;
          priority: number;
          last_test_status: string | null;
          last_tested_at: string | null;
          usage_info: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_name: string;
          category: ProviderCategory;
          enabled?: boolean;
          priority?: number;
          last_test_status?: string | null;
          last_tested_at?: string | null;
          usage_info?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_name?: string;
          category?: ProviderCategory;
          enabled?: boolean;
          priority?: number;
          last_test_status?: string | null;
          last_tested_at?: string | null;
          usage_info?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_secrets: {
        Row: {
          provider_name: string;
          category: ProviderCategory;
          ciphertext: string;
          updated_at: string;
        };
        Insert: {
          provider_name: string;
          category: ProviderCategory;
          ciphertext: string;
          updated_at?: string;
        };
        Update: {
          provider_name?: string;
          category?: ProviderCategory;
          ciphertext?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_provider_settings: {
        Row: {
          id: string;
          provider: string;
          model: string | null;
          use_case: string | null;
          enabled: boolean;
          priority: number;
          last_test_status: string | null;
          last_tested_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          model?: string | null;
          use_case?: string | null;
          enabled?: boolean;
          priority?: number;
          last_test_status?: string | null;
          last_tested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          model?: string | null;
          use_case?: string | null;
          enabled?: boolean;
          priority?: number;
          last_test_status?: string | null;
          last_tested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          type: string;
          title: string;
          body: string | null;
          related_lead_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          title: string;
          body?: string | null;
          related_lead_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          related_lead_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: 'notifications_related_lead_id_fkey'; columns: ['related_lead_id']; isOneToOne: false; referencedRelation: 'leads'; referencedColumns: ['id'] }];
      };
      target_companies: {
        Row: {
          id: string;
          source: TargetCompanySource;
          identifier: string;
          label: string | null;
          extra: Json | null;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: TargetCompanySource;
          identifier: string;
          label?: string | null;
          extra?: Json | null;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: TargetCompanySource;
          identifier?: string;
          label?: string | null;
          extra?: Json | null;
          enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      scoring_config: {
        Row: {
          vertical: string;
          dimension_weights: Json;
          tier_thresholds: Json;
          updated_at: string;
        };
        Insert: {
          vertical: string;
          dimension_weights: Json;
          tier_thresholds: Json;
          updated_at?: string;
        };
        Update: {
          vertical?: string;
          dimension_weights?: Json;
          tier_thresholds?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Company = Database['public']['Tables']['companies']['Row'];
export type CompanySource = Database['public']['Tables']['company_sources']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type Lead = Database['public']['Tables']['leads']['Row'];
export type Evidence = Database['public']['Tables']['evidence']['Row'];
export type LeadSignal = Database['public']['Tables']['lead_signals']['Row'];
export type LeadScore = Database['public']['Tables']['lead_scores']['Row'];
export type LeadStatusHistory = Database['public']['Tables']['lead_status_history']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];
export type LeadTag = Database['public']['Tables']['lead_tags']['Row'];
export type Activity = Database['public']['Tables']['activities']['Row'];
export type Outreach = Database['public']['Tables']['outreach']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];
export type SearchConfig = Database['public']['Tables']['search_configs']['Row'];
export type SavedSearch = Database['public']['Tables']['saved_searches']['Row'];
export type SearchHistory = Database['public']['Tables']['search_history']['Row'];
export type SearchResult = Database['public']['Tables']['search_results']['Row'];
export type ProviderConnection = Database['public']['Tables']['provider_connections']['Row'];
export type ProviderSecret = Database['public']['Tables']['provider_secrets']['Row'];
export type AiProviderSetting = Database['public']['Tables']['ai_provider_settings']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type ScoringConfig = Database['public']['Tables']['scoring_config']['Row'];
export type TargetCompany = Database['public']['Tables']['target_companies']['Row'];
