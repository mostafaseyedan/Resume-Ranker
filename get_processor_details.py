from google.cloud import documentai_v1 as documentai

def get_processor_details(project_id: str, location: str, processor_id: str):
    """Gets the details of a specific processor."""
    client = documentai.DocumentProcessorServiceClient()

    name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
    try:
        processor = client.get_processor(name=name)

        print(f"Details for processor: {processor.display_name}")
        print(f"  ID: {processor.name.split('/')[-1]}")
        print(f"  Type: {processor.type_}")
        print(f"  Default Processor Version: {processor.default_processor_version}")
        print(f"  Create Time: {processor.create_time}")
        print(f"  State: {processor.state}")

    except Exception as e:
        print(f"Error getting processor details: {e}")

if __name__ == "__main__":
    project_id = "cendien-sales-support-ai"
    location = "us"
    processor_id = "9417c7d6cc17f208"  # ExtractPDF processor
    get_processor_details(project_id, location, processor_id)
