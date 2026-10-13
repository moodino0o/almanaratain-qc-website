<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archive_documents', function (Blueprint $table): void {
            $table->increments('id');
            $table->text('original_name');
            $table->text('object_path')->unique();
            $table->text('mime_type');
            $table->integer('size');
            $table->text('category');
            $table->text('subcategory');
            $table->date('document_date')->useCurrent();
            $table->date('expiry_date')->nullable();
            $table->text('description')->default('');
            $table->string('uploaded_by')->nullable();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->index('category', 'archive_documents_category_idx');
            $table->index('subcategory', 'archive_documents_subcategory_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archive_documents');
    }
};
